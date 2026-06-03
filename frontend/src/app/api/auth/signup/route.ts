import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const SignUpSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters").max(50),
  email:    z.string().email("Invalid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password too long"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username max 20 characters")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscores")
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = SignUpSchema.safeParse(body);

    if (!parsed.success) {
      // ✅ Use .issues to extract array details out of the ZodError instance securely
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, username } = parsed.data;

    // Check email already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Check username taken (if provided)
    if (username) {
      const taken = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Auto-generate username if not provided
    const finalUsername = username
      ?? `${email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`;

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        username: finalUsername,
        emailVerified: null,
      })
      .returning({
        id:       users.id,
        email:    users.email,
        username: users.username,
        name:     users.name,
      });

    return NextResponse.json({ user }, { status: 201 });

  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}