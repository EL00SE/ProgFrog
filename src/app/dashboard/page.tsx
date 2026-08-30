import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const posts = user
    ? await prisma.post.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name ?? user?.email}
        </h1>
        <p className="text-muted-foreground text-sm">
          This page is protected by the proxy and re-checked in the Data Access Layer.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your posts</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No posts yet. Run <code className="font-mono">pnpm db:seed</code> to create
            sample data.
          </p>
        ) : (
          <div className="grid gap-3">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">{post.title}</CardTitle>
                  <Badge variant={post.published ? "default" : "secondary"}>
                    {post.published ? "Published" : "Draft"}
                  </Badge>
                </CardHeader>
                {post.content ? (
                  <CardContent className="text-muted-foreground text-sm">
                    {post.content}
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
