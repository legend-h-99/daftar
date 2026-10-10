import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetDashboardSummaryUseCase } from '../application/use-cases/dashboard/get-dashboard-summary.use-case';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getDashboardSummary: GetDashboardSummaryUseCase) {}

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserData, @Query() query: DashboardQueryDto) {
    return this.getDashboardSummary.execute(user.businessId as string, query.month);
  }
}
