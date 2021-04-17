import { Injectable } from "@nestjs/common";
import { Observable, of } from "rxjs";

@Injectable()
export class AppService {
  
  constructor() {
  }
  getHello(): string {
    return 'Hello World!';
  }
  
}
