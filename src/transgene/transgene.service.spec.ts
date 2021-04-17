import { Test, TestingModule } from '@nestjs/testing';
import { TransgeneService } from './transgene.service';

describe('TransgeneService', () => {
  let service: TransgeneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransgeneService],
    }).compile();

    service = module.get<TransgeneService>(TransgeneService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
