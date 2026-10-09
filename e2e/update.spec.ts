import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

test("accepting a new service worker preserves bookings and document blobs", async ({
  page,
}) => {
  let version = 1;
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    const relative = decodeURIComponent(
      new URL(req.url!, "http://localhost").pathname,
    ).replace(/^\/travelapp\//, "");
    const file = resolve(root, relative || "index.html");
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      let bytes = await readFile(file);
      if (relative === "sw.js")
        bytes = Buffer.concat([
          bytes,
          Buffer.from(`\n// test deployment ${version}\n`),
        ]);
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".webmanifest": "application/manifest+json",
          } as Record<string, string>
        )[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server");
  try {
    await page.goto(`http://127.0.0.1:${address.port}/travelapp/`);
    await page
      .getByRole("button", { name: "New trip", exact: true })
      .last()
      .click();
    await page.getByLabel("Trip name").fill("Preserve me");
    await page.getByLabel("Country or countries").fill("UAE");
    await page.getByLabel("Start date").fill("2026-10-01");
    await page.getByLabel("End date").fill("2026-10-05");
    await page.getByRole("button", { name: "Add city", exact: true }).click();
    await page.getByLabel("City 1", { exact: true }).fill("Dubai");
    await page.getByRole("button", { name: "Save trip" }).click();
    await page.getByRole("button", { name: "Hotels", exact: true }).click();
    await page.getByRole("button", { name: "Add hotel", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Keep my booking");
    await page.getByLabel("Check-in", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Check-out", { exact: true }).fill("2026-10-05");
    await page.getByLabel("Amount · Optional").fill("450");
    await page.getByLabel("Attach files · Optional").setInputFiles({
      name: "keep.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 persistent document"),
    });
    await page.getByRole("button", { name: "Save hotel" }).click();
    await expect(page.getByRole("button", { name: "Edit hotel" })).toBeVisible();
    await expect(page.getByText("keep.pdf", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(page.getByText("keep.pdf", { exact: true })).toBeVisible();
    version = 2;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    await expect(page.getByText("A new version is ready.")).toBeVisible();
    await page.getByRole("button", { name: "Edit hotel" }).click();
    await expect(page.getByText("A new version is ready.")).toHaveCount(0);
    await page.getByLabel("Notes · Optional").fill("Saved before update");
    await page.getByRole("button", { name: "Save hotel" }).click();
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(
      page.getByText("Saved before update", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("keep.pdf", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration();
          return !r?.waiting;
        }),
      )
      .toBe(true);
    const href = await page
      .getByRole("link", { name: "Open", exact: true })
      .getAttribute("href");
    expect(
      await page.evaluate(
        async (url) => await (await fetch(url!)).text(),
        href,
      ),
    ).toBe("%PDF-1.4 persistent document");
    await page.getByRole("button", { name: "Budget", exact: true }).click();
    await expect(page.locator(".total")).toHaveText("450.00");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
