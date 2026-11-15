import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { BusinessGuard } from "../common/guards/business.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentUserData } from "../common/types/auth.types";
const KINDS = [
  "OWNER_CONTRIBUTION",
  "LOAN",
  "OWNER_WITHDRAWAL",
  "LOAN_REPAYMENT",
];
class FundingDto {
  @IsUUID() requestId!: string;
  @IsIn(KINDS) kind!: string;
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(100000000)
  amount!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
type Row = {
  id: string;
  requestId: string;
  kind: string;
  amount: number;
  date: string;
  note: string | null;
};
@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller("funding")
export class FundingController {
  constructor(private readonly db: PrismaService) {}
  @Get()
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query("month") month?: string,
  ) {
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new BadRequestException("Invalid month");
    // Aggregate in SQL, never silently truncate financial totals.
    const rows = await this.db.$queryRaw<
      Row[]
    >`SELECT id,"requestId",kind,amount::float8 AS amount,date::text,note FROM "FundingEntry" WHERE "businessId"=${user.businessId} AND (${month ?? null}::text IS NULL OR to_char(date,'YYYY-MM')=${month ?? null}) ORDER BY date DESC,id DESC LIMIT 200`;
    const [totals] = await this.db.$queryRaw<
      { cashIn: number; cashOut: number; count: number }[]
    >`SELECT coalesce(sum(amount) FILTER(WHERE kind IN ('OWNER_CONTRIBUTION','LOAN')),0)::float8 AS "cashIn",coalesce(sum(amount) FILTER(WHERE kind IN ('OWNER_WITHDRAWAL','LOAN_REPAYMENT')),0)::float8 AS "cashOut",count(*)::int AS count FROM "FundingEntry" WHERE "businessId"=${user.businessId} AND (${month ?? null}::text IS NULL OR to_char(date,'YYYY-MM')=${month ?? null})`;
    return { entries: rows, ...totals };
  }
  @Post()
  async create(@CurrentUser() user: CurrentUserData, @Body() body: FundingDto) {
    const date = new Date(body.date);
    const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== body.date ||
      body.date > today
    )
      throw new BadRequestException("Invalid movement date");
    const note = body.note?.trim() || null;
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "FundingEntry" (id,"businessId","requestId",kind,amount,date,note) VALUES (gen_random_uuid()::text,${user.businessId},${body.requestId}::uuid,${body.kind},${body.amount},${body.date}::date,${note}) ON CONFLICT ("businessId","requestId") DO NOTHING`;
      const [row] = await tx.$queryRaw<
        Row[]
      >`SELECT id,"requestId",kind,amount::float8 AS amount,date::text,note FROM "FundingEntry" WHERE "businessId"=${user.businessId} AND "requestId"=${body.requestId}::uuid`;
      if (
        !row ||
        row.kind !== body.kind ||
        row.amount !== body.amount ||
        row.date !== body.date ||
        row.note !== note
      )
        throw new ConflictException("Duplicate request with different data");
      return row;
    });
  }
}
