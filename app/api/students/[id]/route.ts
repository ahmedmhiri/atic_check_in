import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";

// DELETE /api/students/[id]
// Permanently removes the student. Their slot selections, hotel check-in and
// attendance records go with them (onDelete: Cascade in the schema).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  try {
    const s = await prisma.student.delete({
      where: { id: params.id },
      select: { name: true, studentId: true },
    });
    return NextResponse.json({ status: "deleted", student: s });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete student" }, { status: 500 });
  }
}
