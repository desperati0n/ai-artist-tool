import {expect, test} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/react.html');
  await expect(page.getByRole('button', {name: '选择画师 Alpha', exact: true})).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`mouse deselection does not leave edit and delete over the artwork (${theme})`, async ({page}) => {
    if (theme === 'dark') await page.getByRole('button', {name: '切换显示主题'}).filter({visible: true}).click();
    const card = page.getByRole('button', {name: '选择画师 Alpha', exact: true});
    const overlay = card.locator('.artist-card-actions');
    await card.click({position: {x: 40, y: 40}});
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await card.click({position: {x: 40, y: 40}});
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('searchbox').hover();
    await expect(card).toBeFocused();
    await expect(overlay).toHaveCSS('opacity', '0');
    await expect(overlay).toHaveCSS('pointer-events', 'none');
    await page.screenshot({path: test.info().outputPath(`${theme}-deselected.png`)});
    await card.hover();
    await expect(overlay).toHaveCSS('opacity', '1');
    await page.screenshot({path: test.info().outputPath(`${theme}-hover.png`)});
  });
}

test('cancelling an edit restores focus without leaving the mouse overlay visible', async ({page}) => {
  const card = page.getByRole('button', {name: '选择画师 Alpha', exact: true});
  const edit = page.getByRole('button', {name: '编辑 Alpha', exact: true});
  await card.hover();
  await edit.click();
  await page.getByRole('dialog').getByRole('button', {name: '取消', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox').hover();
  await expect(edit).toBeFocused();
  await expect(card.locator('.artist-card-actions')).toHaveCSS('opacity', '0');
});

test('keyboard focus reveals actions and survives an editor cancellation', async ({page}) => {
  const card = page.getByRole('button', {name: '选择画师 Alpha', exact: true});
  const overlay = card.locator('.artist-card-actions');
  await page.getByRole('button', {name: '添加', exact: true}).focus();
  await page.keyboard.press('Tab');
  await expect(card).toBeFocused();
  await expect(overlay).toHaveCSS('opacity', '1');
  await page.keyboard.press('Tab');
  const edit = page.getByRole('button', {name: '编辑 Alpha', exact: true});
  await expect(edit).toBeFocused();
  await expect(overlay).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(edit).toBeFocused();
  await expect(overlay).toHaveCSS('opacity', '1');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name: '删除 Alpha', exact: true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(overlay).toHaveCSS('opacity', '0');
});
