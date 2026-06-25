import { Controller, Inject } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { DirectedMatchService } from "../directed-match/directed-match.service.js";

type StartMatchRequest = {
  tournamentMatchId?: string;
  tournament_match_id?: string;
  slotA?: { userId?: string; displayName?: string; user_id?: string; display_name?: string };
  slot_a?: { userId?: string; displayName?: string; user_id?: string; display_name?: string };
  slotB?: { userId?: string; displayName?: string; user_id?: string; display_name?: string };
  slot_b?: { userId?: string; displayName?: string; user_id?: string; display_name?: string };
};

@Controller()
export class TournamentsGrpcController {
  constructor(
    @Inject(DirectedMatchService) private readonly directedMatchService: DirectedMatchService,
  ) {}

  @GrpcMethod("Tournaments", "StartMatch")
  async startMatch(data: StartMatchRequest) {
    const slotA = data.slotA ?? data.slot_a;
    const slotB = data.slotB ?? data.slot_b;
    const tournamentMatchId = data.tournamentMatchId ?? data.tournament_match_id ?? "";

    const result = await this.directedMatchService.startMatch({
      tournamentMatchId,
      slotA: {
        userId: slotA?.userId ?? slotA?.user_id ?? "",
        displayName: slotA?.displayName ?? slotA?.display_name ?? "",
      },
      slotB: {
        userId: slotB?.userId ?? slotB?.user_id ?? "",
        displayName: slotB?.displayName ?? slotB?.display_name ?? "",
      },
    });

    if (!result.ok) {
      return {
        success: false,
        matchId: "",
        match_id: "",
        errorCode: result.code,
        error_code: result.code,
      };
    }

    return {
      success: true,
      matchId: result.matchId,
      match_id: result.matchId,
      errorCode: "",
      error_code: "",
    };
  }
}
