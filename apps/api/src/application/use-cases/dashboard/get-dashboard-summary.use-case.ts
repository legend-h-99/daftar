import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_QUERY, IDashboardQuery, DashboardSummary } from '../../ports/queries/dashboard.query.port';

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(DASHBOARD_QUERY) private readonly dashboardQuery: IDashboardQuery,
  ) {}

  async execute(businessId: string, month?: string): Promise<DashboardSummary> {
    try {
      return await this.dashboardQuery.summary(businessId, month);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid month')) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
