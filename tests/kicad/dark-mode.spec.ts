import { test, expect } from './fixtures';
import { compareToReference, hideCursor, PCBNEW_HEADER_REGION } from './utils/screenshot-compare';
import { waitForEditorReady } from '../e2e/utils/element-tracker';

/**
 * Dark-mode regression test.
 *
 * The wasm/wxUniversal UI always renders a light theme regardless of the
 * browser's prefers-color-scheme; KIPLATFORM::UI::IsDarkTheme() must report
 * that rendered theme, not the browser preference. When it reported the
 * browser preference, a dark-mode browser got dark-variant (light-stroke)
 * icons and dark widget colours painted onto the light UI.
 *
 * This test boots the current pcbnew build once in light mode and once with the
 * browser forced to dark mode, then compares their headers. Using a same-run
 * light reference keeps deliberate menu/toolbar pruning independent from this
 * theme regression gate.
 */

test.describe('PCBnew dark-mode browser', () => {
    test('toolbar icons render the light theme under a dark-mode browser', async ({ browser }) => {
        const lightContext = await browser.newContext({
            colorScheme: 'light',
            viewport: { width: 1280, height: 720 },
        });
        const lightPage = await lightContext.newPage();
        await lightPage.goto('/kicad/pcbnew.html');
        await waitForEditorReady(lightPage);
        await hideCursor(lightPage);
        await lightPage.screenshot({
            path: 'test-results/pcbnew-light-mode-current.png',
            scale: 'css',
        });
        await lightContext.close();

        const darkContext = await browser.newContext({
            colorScheme: 'dark',
            viewport: { width: 1280, height: 720 },
        });
        const page = await darkContext.newPage();
        await page.goto('/kicad/pcbnew.html');

        // Sanity-check the browser really reports dark mode to the app.
        expect(await page.evaluate(() =>
            window.matchMedia('(prefers-color-scheme: dark)').matches
        )).toBe(true);

        await waitForEditorReady(page);
        await hideCursor(page);

        const cssScreenshot = await page.screenshot({
            path: 'test-results/pcbnew-dark-mode-loaded.png',
            scale: 'css'
        });

        const reference = await compareToReference(
            page,
            cssScreenshot,
            'test-results/pcbnew-light-mode-current.png',
            PCBNEW_HEADER_REGION,
        );

        expect(reference.actualWidth).toBe(reference.referenceWidth);
        expect(reference.actualHeight).toBe(reference.referenceHeight);
        expect(reference.diffRatio, 'header diff ratio vs light-mode reference').toBeLessThan(PCBNEW_HEADER_REGION.maxDiffRatio);
        expect(reference.meanChannelDiff, 'header mean channel diff vs light-mode reference').toBeLessThan(PCBNEW_HEADER_REGION.maxMeanChannelDiff);
        await darkContext.close();
    });
});
