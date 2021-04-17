import { Test, TestingModule } from '@nestjs/testing';
import { TransgeneController } from './transgene.controller';
import { TransgeneService } from './transgene.service';

describe('TransgeneController', () => {
  let controller: TransgeneController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransgeneController],
      providers: [TransgeneService],
    }).compile();

    controller = module.get<TransgeneController>(TransgeneController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
