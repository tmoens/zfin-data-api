import { Test, TestingModule } from '@nestjs/testing';
import { MutationController } from './mutation.controller';
import { MutationService } from './mutation.service';

describe('MutationController', () => {
  let controller: MutationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MutationController],
      providers: [MutationService],
    }).compile();

    controller = module.get<MutationController>(MutationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
