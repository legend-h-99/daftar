import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExpenseCrudService } from '../application/use-cases/expenses/expense-crud.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { FindExpensesQueryDto } from './dto/find-expenses-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenseService: ExpenseCrudService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateExpenseDto) {
    return this.expenseService.create(user.businessId as string, {
      category: dto.category,
      amount: dto.amount,
      date: dto.date,
      note: dto.note,
    });
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() query: FindExpensesQueryDto) {
    return this.expenseService.findAll(user.businessId as string, {
      month: query.month,
      limit: query.limit,
      skip: query.skip,
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.expenseService.remove(user.businessId as string, id);
  }
}
