import puppeteer from 'puppeteer';
import jwt from 'jsonwebtoken';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const token = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000001', email: 'admin@myats.dev', role: 'admin' },
      'DAI2cfADbvJpZr4OREHttjpeDf20OY15jNhS4cxG2XI=',
      { expiresIn: '8h' }
    );

    // Go to an empty page to set localStorage
    await page.goto('http://localhost:5173');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);

    // Navigate to Placements tab
    await page.goto('http://localhost:5173/placements', { waitUntil: 'networkidle0' });
    
    // Take a screenshot of the Placements table
    await page.screenshot({ path: '/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/placements_tab.png', fullPage: true });

    // Navigate to a candidate profile
    await page.goto('http://localhost:5173/candidates', { waitUntil: 'networkidle0' });
    
    // Click on the first candidate row
    await page.click('button.bg-white.rounded-2xl');
    await page.waitForNetworkIdle();
    
    // Take a screenshot of the Candidate Profile
    await page.screenshot({ path: '/Users/deeproot/.gemini/antigravity/brain/5bbeb9d3-3099-429f-9f33-443f8466a52c/candidate_profile.png' });

    await browser.close();
    console.log("Screenshots saved successfully.");
  } catch (err) {
    console.error("Failed:", err);
  }
})();
