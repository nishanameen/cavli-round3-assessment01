import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import app from '../dist/worker.mjs';

const module = process.env.CAVLI_PLAYWRIGHT
  ? pathToFileURL(join(process.env.CAVLI_PLAYWRIGHT, 'index.mjs')).href : 'playwright';
const { chromium } = await import(module);
const browser = await chromium.launch({executablePath:process.env.CAVLI_CHROME,headless:true});
const browserErrors = [];
const base = 'http://localhost:8789';
const assets = {'/':['index.html','text/html'],'/styles.css':['styles.css','text/css'],'/app.js':['app.js','text/javascript'],'/cavli-logo.svg':['cavli-logo.svg','image/svg+xml'],
  ...Object.fromEntries(['400','500','600'].map(w=>['/fonts/space-grotesk-latin-'+w+'-normal.woff2',['fonts/space-grotesk-latin-'+w+'-normal.woff2','font/woff2']]))};
const captured = [];
const env = {PREVIEW_FEEDBACK: async entry => captured.push(entry), ASSETS:{async fetch(request) {
  const asset = assets[new URL(request.url).pathname];
  return asset ? new Response(await readFile('dist/web/' + asset[0]), {headers:{'Content-Type':asset[1]}})
    : new Response(null,{status:404});
}}};
await mkdir('outputs/private',{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  // Reduced motion holds the prompt-chip rows still, so a chip can be clicked by name.
  await page.emulateMedia({reducedMotion:'reduce'});
  page.on('pageerror',error=>browserErrors.push(error.message));
  await page.route(base + '/**',async route=>{
    const original=route.request();
    const request=new Request(original.url(),{method:original.method(),headers:original.headers(),body:original.postData()});
    const response=await app.fetch(request,env);
    if (original.url().endsWith('/api/chat')) await new Promise(resolve=>setTimeout(resolve,600));
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto(base);
  await page.getByRole('heading',{name:'Ask about a Cavli module'}).waitFor();
  await page.screenshot({path:'outputs/private/desktop.png'});
  await page.getByRole('button',{name:'Sources'}).click();
  assert.equal(await page.getByRole('complementary',{name:'Product sources'}).getByRole('link').count(),2);
  await page.screenshot({path:'outputs/private/sources.png'});
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('img',{name:'Cavli Wireless'}).evaluate(img=>img.complete && img.naturalWidth>0),true);
  await page.getByRole('button',{name:'Shortlist by throughput'}).click();
  assert.match(await page.getByRole('textbox',{name:'Your question'}).inputValue(),/at least 20 Mbps/);
  await page.getByRole('button',{name:'Send question'}).click();
  await page.getByRole('status').filter({hasText:/Checking product sources/}).waitFor({timeout:5000});
  await page.getByText(/Shortlist C20QM/).waitFor();
  const inspector = page.getByRole('complementary',{name:'Sources for this answer'});
  await inspector.waitFor();
  assert.equal(await inspector.getByRole('link').count(),2);
  const citation = page.getByRole('button',{name:/View citation 2:/});
  await citation.click();
  assert(await inspector.getByRole('link').nth(1).evaluate(link=>link === document.activeElement));
  await page.keyboard.press('Escape');
  assert(await citation.evaluate(button=>button === document.activeElement));
  await citation.click();
  await page.screenshot({path:'outputs/private/recommendation.png'});
  await page.getByRole('button',{name:'Needs review'}).click();
  await page.getByRole('button',{name:'Weak citation'}).click();
  await page.getByText('Thanks for your feedback.').waitFor();
  assert.equal(captured[0].reason,'weak_citation');
  assert.equal(captured[0].status,'recommendation');
  assert.equal(captured[0].evidence_ids.length,2);
  await page.screenshot({path:'outputs/private/feedback.png'});
  await page.getByRole('textbox').fill('Will it work with my custom antenna?');
  await page.getByRole('textbox').press('Enter');
  await page.getByText(/That’s not verified/).waitFor();
  assert.equal(await page.getByRole('link',{name:'Cavli support'}).count(),1);
  await page.screenshot({path:'outputs/private/fallback.png'});
  await page.getByRole('button',{name:'New chat'}).click();
  await page.setViewportSize({width:375,height:740});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('heading',{name:'Ask about a Cavli module'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true);
  await page.screenshot({path:'outputs/private/mobile.png'});
  await page.getByRole('button',{name:'Check India LTE bands'}).click();
  await page.getByRole('textbox',{name:'Your question'}).press('Enter');
  await page.getByText(/1, 3, 5, 8, 40, and 41/).waitFor();
  const mobileCitation = page.getByRole('button',{name:/View citation 1:/});
  await mobileCitation.click();
  const sheet = page.getByRole('dialog',{name:'Sources for this answer'});
  await sheet.getByRole('link',{name:/C16QS product page/}).waitFor();
  await page.screenshot({path:'outputs/private/mobile-answer.png'});
  await page.keyboard.press('Escape');
  assert.equal(await sheet.count(),0);
  assert(await mobileCitation.evaluate(button=>button === document.activeElement));
  assert.deepEqual(browserErrors,[]);
  const checks=['Desktop and 375px mobile view','Official logo loads','Prompt chip fills the input before sending','Pending indicator appears',
    'Desktop source inspector, mobile source sheet, citation focus and Escape','Product shortlist and links','Feedback confirmed and linked to answer evidence IDs',
    'Keyboard send and evidence fallback','Reset, mobile band question, and no browser errors'];
  await writeFile('outputs/browser-check.json',JSON.stringify({passed:true,checks,transport:'Playwright routes browser requests to the bundled Worker in-process'},null,2));
  console.log(checks.map(check=>'PASS · '+check).join('\n'));
} finally { await browser.close(); }
