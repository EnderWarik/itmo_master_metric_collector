import { IsUrl } from 'class-validator';

export class CollectMetricsDto {
  @IsUrl({ require_tld: false })
  url!: string;
}
