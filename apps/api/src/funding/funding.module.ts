import { Module } from "@nestjs/common";
import { FundingController } from "./funding.controller";
@Module({ controllers: [FundingController] })
export class FundingModule {}
