/** Local stand-ins for GitHub's GraphQL and REST APIs, for testing a client's behavior. */

export interface StubThread {
  id: string;
  locked: boolean;
  comments: string[];
}

export interface GraphqlStub {
  url: string;
  token: string;
  threads: Map<number, StubThread>;
  requests: { query: string; variables: Record<string, unknown> }[];
  /** Behavior switches, changeable while the stand-in runs. */
  options: GraphqlOptions;
  stop: () => void;
}

export interface GraphqlOptions {
  failLock?: boolean;
  /** How the thread query misbehaves, if at all. */
  threadError?: "forbidden" | "partial" | "repo-missing" | "vanish-on-page-2";
}

/** Serves the three GraphQL operations the clock uses, with comments paged `pageSize` at a time. */
export function startGraphqlStub(
  threads: Record<number, Partial<StubThread> | undefined>,
  pageSize = 2,
  options: GraphqlOptions = {},
): GraphqlStub {
  const token = "test-token";
  const state = new Map<number, StubThread>();
  for (const [number, thread] of Object.entries(threads)) {
    if (thread) {
      state.set(Number(number), {
        id: thread.id ?? `D_${number}`,
        locked: thread.locked ?? false,
        comments: [...(thread.comments ?? [])],
      });
    }
  }
  const requests: GraphqlStub["requests"] = [];
  const byId = (id: unknown) => [...state.values()].find((thread) => thread.id === id);
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return new Response("unauthorized", { status: 401 });
      }
      const { query, variables } = (await request.json()) as {
        query: string;
        variables: Record<string, unknown>;
      };
      requests.push({ query, variables });
      if (query.includes("lockLockable")) {
        if (options.failLock) {
          return Response.json({ errors: [{ message: "Resource not accessible by integration" }] });
        }
        const thread = byId(variables.id);
        if (!thread) return Response.json({ errors: [{ message: "no such node" }] });
        thread.locked = true;
        return Response.json({ data: { lockLockable: { lockedRecord: { locked: true } } } });
      }
      if (query.includes("addDiscussionComment")) {
        const thread = byId(variables.id);
        if (!thread) return Response.json({ errors: [{ message: "no such node" }] });
        thread.comments.push(String(variables.body));
        return Response.json({ data: { addDiscussionComment: { comment: { id: "C_1" } } } });
      }
      if (options.threadError === "forbidden") {
        return Response.json({
          data: { repository: { discussion: null } },
          errors: [{ type: "FORBIDDEN", message: "Resource not accessible by integration" }],
        });
      }
      if (options.threadError === "repo-missing") {
        return Response.json({
          data: { repository: null },
          errors: [{ type: "NOT_FOUND", message: "Could not resolve to a Repository" }],
        });
      }
      if (options.threadError === "vanish-on-page-2" && variables.after) {
        return Response.json({
          data: { repository: { discussion: null } },
          errors: [{ type: "NOT_FOUND", message: "Could not resolve to a Discussion" }],
        });
      }
      const thread = state.get(Number(variables.number));
      if (!thread) {
        return Response.json({
          data: { repository: { discussion: null } },
          errors: [{ type: "NOT_FOUND", message: "Could not resolve to a Discussion" }],
        });
      }
      const start = variables.after ? Number(variables.after) : 0;
      const page = thread.comments.slice(start, start + pageSize);
      const end = start + page.length;
      return Response.json({
        ...(options.threadError === "partial"
          ? { errors: [{ type: "SERVICE_UNAVAILABLE", message: "partial answer" }] }
          : {}),
        data: {
          repository: {
            discussion: {
              id: thread.id,
              locked: thread.locked,
              comments: {
                pageInfo: {
                  hasNextPage: end < thread.comments.length,
                  endCursor: String(end),
                },
                nodes: page.map((body) => ({ body })),
              },
            },
          },
        },
      });
    },
  });
  return {
    url: `http://localhost:${server.port}/graphql`,
    token,
    threads: state,
    requests,
    options,
    stop: () => server.stop(true),
  };
}

export interface StubPull {
  number: number;
  files: { filename: string; status: string }[];
}

export interface RestStub {
  url: string;
  paths: string[];
  stop: () => void;
}

/** Serves `GET /repos/{repo}/pulls` and `/pulls/{n}/files`, paged at 100 like GitHub. */
export function startRestStub(
  repo: string,
  pulls: StubPull[],
  failures: { list?: number; files?: { pr: number; status: number } } = {},
): RestStub {
  const paths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      paths.push(url.pathname);
      const page = Number(url.searchParams.get("page") ?? "1");
      const slice = <T>(items: T[]) => items.slice((page - 1) * 100, page * 100);
      if (url.pathname === `/repos/${repo}/pulls`) {
        if (failures.list) return new Response("list failed", { status: failures.list });
        return Response.json(slice(pulls.map((p) => ({ number: p.number }))));
      }
      const match = new RegExp(`^/repos/${repo}/pulls/(\\d+)/files$`).exec(url.pathname);
      if (match && failures.files && Number(match[1]) === failures.files.pr) {
        return new Response("files failed", { status: failures.files.status });
      }
      const pull = match ? pulls.find((p) => p.number === Number(match[1])) : undefined;
      if (pull) return Response.json(slice(pull.files));
      return new Response("not found", { status: 404 });
    },
  });
  return { url: `http://localhost:${server.port}`, paths, stop: () => server.stop(true) };
}
