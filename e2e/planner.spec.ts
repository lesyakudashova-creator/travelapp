import { test, expect, type Page } from "@playwright/test";
async function newTrip(page: Page) {
  await page.goto("");
  await page
    .getByRole("button", { name: "New trip", exact: true })
    .last()
    .click();
  await page.getByLabel("Trip name").fill("China · Китай 中国");
  await page.getByLabel("Country or countries").fill("China");
  await page.getByLabel("Start date").fill("2026-10-31");
  await page.getByLabel("End date").fill("2026-11-14");
  await page.getByRole("button", { name: "Add city", exact: true }).click();
  await page.getByLabel("City 1", { exact: true }).fill("Shanghai 上海");
  await page.getByRole("button", { name: "Add city", exact: true }).click();
  await page.getByLabel("City 2", { exact: true }).fill("Beijing 北京");
  for (const [i, city, start, end] of [
    [0, "Shanghai 上海", "2026-10-31", "2026-11-04"],
    [1, "Beijing 北京", "2026-11-04", "2026-11-10"],
    [2, "Shanghai 上海", "2026-11-10", "2026-11-14"],
  ] as const) {
    await page.getByRole("button", { name: "Add stay", exact: true }).click();
    const row = page.locator(".stay-edit").nth(i);
    await row.getByLabel("City", { exact: true }).selectOption({ label: city });
    await row.getByLabel("From", { exact: true }).fill(start);
    await row.getByLabel("Until", { exact: true }).fill(end);
  }
  await page.getByRole("button", { name: "Save trip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Day plan" })).toBeVisible();
}
test("complete local journey, linked budget, documents and offline restart", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await newTrip(page);
  await expect(page.locator(".route-list li")).toHaveCount(3);
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Yu Garden 豫园");
  await page.getByLabel("Date · Optional").fill("2026-11-01");
  await page.getByLabel("Local address · Optional").fill("上海市黄浦区安仁街");
  await page.getByLabel("Amount · Optional").fill("50");
  await page.getByLabel("Currency", { exact: true }).fill("CNY");
  await page.getByRole("button", { name: "Save place" }).click();
  await page.getByRole("button", { name: "Mark visited" }).click();
  await expect(
    page.getByRole("button", { name: "Visited", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hotels", exact: true }).click();
  await page.getByRole("button", { name: "Add hotel", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Shanghai stay");
  await page.getByLabel("Check-in", { exact: true }).fill("2026-10-31");
  await page.getByLabel("Check-out", { exact: true }).fill("2026-11-04");
  await page.getByLabel("Amount · Optional").fill("1000");
  await page.getByLabel("Currency", { exact: true }).fill("CNY");
  await page.getByLabel("Booking reference · Optional").fill("BOOK-123");
  await page.getByLabel("Attach files · Optional").setInputFiles([
    {
      name: "confirmation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
    },
    {
      name: "map.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1cAAAAASUVORK5CYII=",
        "base64",
      ),
    },
  ]);
  await page.getByRole("button", { name: "Save hotel" }).click();
  await expect(
    page.getByText("confirmation.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.getByText(/Total is incomplete/)).toBeVisible();
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Set exchange rates" }).click();
  await page.getByLabel("1 CNY = … AED").fill("0.5");
  await page.getByRole("button", { name: "Save rates" }).click();
  await expect(page.locator(".total")).toHaveText("500.00");
  await page.locator(".expense-row").click();
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await page.getByRole("button", { name: "Edit hotel" }).click();
  await page.getByLabel("Amount · Optional").fill("1200");
  await page.getByRole("button", { name: "Save hotel" }).click();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator(".total")).toHaveText("600.00");
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await expect(
    page.locator(".budget-split").getByText("AED 600.00"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Transport", exact: true }).click();
  await page
    .getByRole("button", { name: "Add transport", exact: true })
    .click();
  await page.getByLabel("Journey name").fill("Train to Beijing");
  await page.getByLabel("From", { exact: true }).fill("Shanghai Hongqiao");
  await page.getByLabel("To", { exact: true }).fill("Beijing South");
  await page.getByLabel("Departure date").fill("2026-11-04");
  await page.getByLabel("Arrival date").fill("2026-11-04");
  await page.getByLabel("Departure time").fill("09:00");
  await page.getByLabel("Arrival time").fill("14:00");
  await page.getByRole("button", { name: "Save transport" }).click();
  await expect(
    page.getByText("Shanghai Hongqiao", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByLabel("Plan date").fill("2026-11-01");
  await expect(page.locator(".plan-row")).toContainText("Yu Garden");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Day plan" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Day plan" })).toBeVisible();
  await page.getByRole("button", { name: "Hotels", exact: true }).click();
  await page.getByRole("button", { name: /Shanghai stay/ }).click();
  await expect(
    page.getByText("confirmation.pdf", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".document-row")
    .filter({ hasText: "map.png" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.locator(".document-image")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".document-image")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const pdf = page
    .locator(".document-row")
    .filter({ hasText: "confirmation.pdf" })
    .getByRole("link", { name: "Open" });
  expect(await pdf.getAttribute("href")).toMatch(/^blob:/);
  const href = await pdf.getAttribute("href");
  expect(
    await page.evaluate(
      async (url) => (await (await fetch(url!)).text()).startsWith("%PDF"),
      href,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit hotel" }).click();
  await page.getByLabel("Notes · Optional").fill("Saved offline");
  await page.getByRole("button", { name: "Save hotel" }).click();
  await expect(page.getByRole("button", { name: "Edit hotel" })).toBeVisible();
  await expect(page.getByText("Saved offline", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved offline", { exact: true })).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
test("mobile layout at all target widths, long text and empty states", async ({
  page,
}) => {
  await newTrip(page);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      "Overview",
      "Places",
      "Hotels",
      "Transport",
      "Budget",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: "Edit trip" }).click();
  await page
    .getByLabel("Trip name")
    .fill(
      "Очень длинное название путешествия по нескольким городам 中国 上海 北京",
    );
  await page.getByRole("button", { name: "Save trip" }).click();
  await page.evaluate(() => (document.documentElement.style.fontSize = "20px"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("reordering and unscheduling retains saved places", async ({ page }) => {
  await newTrip(page);
  for (const name of ["First place", "Second place"]) {
    await page.getByRole("button", { name: "Places", exact: true }).click();
    await page.getByRole("button", { name: "Add place", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Date · Optional").fill("2026-10-31");
    await page.getByRole("button", { name: "Save place" }).click();
  }
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Move Second place up" }).click();
  await expect(page.locator(".plan-row").first()).toContainText("Second place");
  await page.reload();
  await expect(page.locator(".plan-row").first()).toContainText("Second place");
  await page
    .getByRole("button", { name: "Any time Second place Food" })
    .click();
  await page.getByRole("button", { name: "Remove from day plan" }).click();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(2);
  await expect(
    page.locator(".entry-card").filter({ hasText: "Second place" }),
  ).toContainText("Not scheduled");
});

test("manual spending, custom categories, cover photo and deletion", async ({
  page,
}) => {
  await newTrip(page);
  await page.getByRole("button", { name: "Edit trip" }).click();
  await page
    .getByLabel("Cover photo · Optional")
    .setInputFiles("public/icon-512.png");
  await page.getByRole("button", { name: "Save trip" }).click();
  await expect(page.getByAltText("Trip cover")).toBeVisible();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Manage categories" }).click();
  await page.getByLabel("Category 1", { exact: true }).fill("Cafés & bakeries");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category 7", { exact: true }).fill("Parks");
  await page.getByRole("button", { name: "Save categories" }).click();
  await expect(
    page.getByRole("button", { name: "Parks", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await page
    .getByLabel("Name", { exact: true })
    .fill(
      "Место с очень длинным названием в центре города 上海城市中心很长的名字",
    );
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Parks" });
  await page.getByRole("button", { name: "Save place" }).click();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Parks", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/places-populated.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Dinner");
  await page.getByLabel("Amount", { exact: true }).fill("25,55");
  await page.getByLabel("Category", { exact: true }).selectOption("Food");
  await page.getByLabel("Payment status", { exact: true }).selectOption("Paid");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator(".total")).toHaveText("25.55");
  await page.screenshot({
    path: "test-results/budget-populated.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hotels", exact: true }).click();
  await page.getByRole("button", { name: "Add hotel", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Document test");
  await page.getByLabel("Check-in", { exact: true }).fill("2026-10-31");
  await page.getByLabel("Check-out", { exact: true }).fill("2026-11-04");
  await page.getByLabel("Amount · Optional").fill("100");
  await page
    .getByLabel("Attach files · Optional")
    .setInputFiles({
      name: "wrong.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a document"),
    });
  await expect(page.getByRole("alert").first()).toContainText("choose PDF");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Document test",
  );
  await page
    .getByLabel("Attach files · Optional")
    .setInputFiles({
      name: "reservation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
  await page.getByRole("button", { name: "Save hotel" }).click();
  await page.screenshot({
    path: "test-results/hotel-details.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Delete hotel", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("linked budget expense");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.locator(".total")).toHaveText("25.55");
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Delete trip", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete trip", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your journey starts here" }),
  ).toBeVisible();
});
