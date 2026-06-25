import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type {
  DirectedMatchService,
  StartDirectedMatchResult,
} from "../directed-match/directed-match.service.js";
import { TournamentsGrpcController } from "./tournaments-grpc.controller.js";

describe("TournamentsGrpcController", () => {
  let directedMatchService: {
    startMatch: jest.Mock<(input: unknown) => Promise<StartDirectedMatchResult>>;
  };
  let controller: TournamentsGrpcController;

  beforeEach(() => {
    directedMatchService = {
      startMatch: jest.fn<(input: unknown) => Promise<StartDirectedMatchResult>>(),
    };
    controller = new TournamentsGrpcController(
      directedMatchService as unknown as DirectedMatchService,
    );
  });

  it("maps a successful StartMatch request to the gRPC response", async () => {
    directedMatchService.startMatch.mockResolvedValue({
      ok: true,
      matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const response = await controller.startMatch({
      tournament_match_id: "33333333-3333-4333-8333-333333333333",
      slot_a: { user_id: "11111111-1111-4111-8111-111111111111", display_name: "Ace" },
      slot_b: { user_id: "22222222-2222-4222-8222-222222222222", display_name: "Bob" },
    });

    expect(response).toEqual({
      success: true,
      matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      match_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      errorCode: "",
      error_code: "",
    });
  });

  it("maps service errors to the gRPC response", async () => {
    directedMatchService.startMatch.mockResolvedValue({
      ok: false,
      code: "PLAYER_ALREADY_IN_MATCH",
    });

    const response = await controller.startMatch({
      tournament_match_id: "33333333-3333-4333-8333-333333333333",
      slot_a: { user_id: "11111111-1111-4111-8111-111111111111", display_name: "Ace" },
      slot_b: { user_id: "22222222-2222-4222-8222-222222222222", display_name: "Bob" },
    });

    expect(response).toEqual({
      success: false,
      matchId: "",
      match_id: "",
      errorCode: "PLAYER_ALREADY_IN_MATCH",
      error_code: "PLAYER_ALREADY_IN_MATCH",
    });
  });
});
