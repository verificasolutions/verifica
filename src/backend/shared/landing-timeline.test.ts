import { describe, expect, it } from "vitest";
import { deriveLandingTimeline } from "./landing-timeline";

type Post = { id: string };

function posts(count: number): Post[] {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}` }));
}

describe("deriveLandingTimeline (feed/galeria/drawer da mesma linha do tempo)", () => {
  it("com 5 publicações: feed=3, galeria=5, drawer=5 (ordem preservada)", () => {
    const list = posts(5);
    const timeline = deriveLandingTimeline(list);
    expect(timeline.feed.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(timeline.gallery.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(timeline.drawer).toHaveLength(5);
  });

  it("com 12 publicações: feed=3, galeria=8, drawer=12", () => {
    const list = posts(12);
    const timeline = deriveLandingTimeline(list);
    expect(timeline.feed).toHaveLength(3);
    expect(timeline.gallery).toHaveLength(8);
    expect(timeline.drawer).toHaveLength(12);
    expect(timeline.gallery[0].id).toBe("p1");
    expect(timeline.gallery[7].id).toBe("p8");
  });

  it("com 1 publicação: feed=1, galeria=1 (sem controles desnecessários)", () => {
    const timeline = deriveLandingTimeline(posts(1));
    expect(timeline.feed).toHaveLength(1);
    expect(timeline.gallery).toHaveLength(1);
  });

  it("com 0 publicações: tudo vazio", () => {
    const timeline = deriveLandingTimeline<Post>([]);
    expect(timeline.feed).toHaveLength(0);
    expect(timeline.gallery).toHaveLength(0);
    expect(timeline.drawer).toHaveLength(0);
  });
});
