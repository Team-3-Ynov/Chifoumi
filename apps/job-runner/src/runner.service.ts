import { Injectable } from "@nestjs/common";

@Injectable()
export class RunnerService {
  markReady() {
    console.log("[job-runner] ready");
  }
}
