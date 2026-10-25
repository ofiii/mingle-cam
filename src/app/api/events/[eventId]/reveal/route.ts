import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    // Trigger instant reveal: update event's revealDate to now, mark photos isRevealed: true
    const now = new Date();

    const [updatedEvent] = await prisma.$transaction([
      prisma.event.update({
        where: { id: eventId },
        data: { revealDate: now },
      }),
      prisma.photo.updateMany({
        where: { eventId },
        data: { isRevealed: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: "Event photos revealed successfully",
    });
  } catch (error) {
    console.error("[REVEAL_EVENT_ERROR]", error);
    return NextResponse.json({ error: "Failed to reveal event photos" }, { status: 500 });
  }
}
