import { IsUrl } from 'class-validator';

export class CollectMetricsDto {
  @IsUrl()
  url!: string;
}

