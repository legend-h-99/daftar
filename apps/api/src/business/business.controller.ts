import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard)
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateBusinessDto) {
    return this.businessService.create(user, dto);
  }

  @UseGuards(BusinessGuard)
  @Get()
  findCurrent(@CurrentUser() user: CurrentUserData) {
    return this.businessService.findCurrent(user.businessId as string);
  }

  @UseGuards(BusinessGuard)
  @Patch()
  update(@CurrentUser() user: CurrentUserData, @Body() dto: UpdateBusinessDto) {
    return this.businessService.update(user.businessId as string, dto);
  }
}
