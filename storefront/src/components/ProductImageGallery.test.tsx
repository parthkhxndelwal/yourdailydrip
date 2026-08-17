import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isVideoUrl } from "@/lib/products";

import { ProductImageGallery } from "./ProductImageGallery";

describe("isVideoUrl", () => {
  it("returns true for a .mp4 URL", () => {
    expect(isVideoUrl("https://cdn.example.com/v.mp4")).toBe(true);
  });

  it("returns true for a .webm URL with a query string", () => {
    expect(isVideoUrl("https://cdn.example.com/v.webm?x=1")).toBe(true);
  });

  it("is case-insensitive for .MOV", () => {
    expect(isVideoUrl("https://cdn.example.com/v.MOV")).toBe(true);
  });

  it("returns false for a .jpg URL", () => {
    expect(isVideoUrl("https://cdn.example.com/p.jpg")).toBe(false);
  });

  it("returns false for a .png URL", () => {
    expect(isVideoUrl("https://cdn.example.com/p.png")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isVideoUrl("")).toBe(false);
  });
});

describe("ProductImageGallery", () => {
  it("renders an <img> and no <video> for an image URL", () => {
    render(
      <ProductImageGallery
        name="Test"
        images={["https://cdn.example.com/p.jpg"]}
        active={0}
        onSelect={() => {}}
      />,
    );

    expect(document.querySelector("img")).not.toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("renders a <video> with src and controls for a video URL", () => {
    render(
      <ProductImageGallery
        name="Test"
        images={["https://cdn.example.com/v.mp4"]}
        active={0}
        onSelect={() => {}}
      />,
    );

    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("https://cdn.example.com/v.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders a video main media with mixed video/image thumbnails", () => {
    render(
      <ProductImageGallery
        name="Test"
        images={["https://cdn.example.com/v.mp4", "https://cdn.example.com/p.jpg"]}
        active={0}
        onSelect={() => {}}
      />,
    );

    const thumbnails = document.querySelectorAll(".size-20");
    expect(thumbnails[0]?.querySelector("video")).not.toBeNull();
    expect(thumbnails[1]?.querySelector("img")).not.toBeNull();
  });
});