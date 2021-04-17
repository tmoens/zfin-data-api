import { Test, TestingModule } from '@nestjs/testing';
import { MutationService } from './mutation.service';

describe('MutationService', () => {
  let service: MutationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MutationService],
    }).compile();

    service = module.get<MutationService>(MutationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
