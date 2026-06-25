import { Inject, Injectable } from "@nestjs/common";
import { NotificationsQueueService } from "../queues/notifications-queue.service.js";
import type { TournamentMatchReadyInput } from "./tournament-progression.types.js";

@Injectable()
export class TournamentMatchReadyService {
  constructor(
    @Inject(NotificationsQueueService)
    private readonly notificationsQueue: NotificationsQueueService,
  ) {}

  async notifyPlayersMatchReady(input: TournamentMatchReadyInput): Promise<void> {
    await Promise.all([
      this.notificationsQueue.enqueueTournamentMatchReadyMail({
        to: input.slotA.email,
        displayName: TournamentMatchReadyService.sanitizeForTemplate(input.slotA.displayName),
        opponentDisplayName: TournamentMatchReadyService.sanitizeForTemplate(
          input.slotB.displayName,
        ),
        tournamentName: input.tournamentName,
      }),
      this.notificationsQueue.enqueueTournamentMatchReadyMail({
        to: input.slotB.email,
        displayName: TournamentMatchReadyService.sanitizeForTemplate(input.slotB.displayName),
        opponentDisplayName: TournamentMatchReadyService.sanitizeForTemplate(
          input.slotA.displayName,
        ),
        tournamentName: input.tournamentName,
      }),
    ]);
  }

  private static sanitizeForTemplate(displayName: string): string {
    return displayName.replace(/__[A-Z_]+__/g, "");
  }
}
