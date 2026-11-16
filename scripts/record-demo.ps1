$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$chapters = @(
    @{ Image='desktop'; Title='01 / Product discovery'; Text='This is the Cavli Module Assistant, a prototype for the first assessment. It focuses on two cellular IoT modules, the C sixteen Q S and the C twenty Q M. The start screen offers common questions about speed, cellular bands, and e SIM options. Customers can also type a question in their own words. The thinking orb from Libraries dot dev appears while the app is working. In this recorded preview, answers come from the checked-in catalog. I verified the hosted Supabase services separately.' },
    @{ Image='sources'; Title='02 / Approved product sources'; Text='The source menu shows the two public Cavli product pages used to build the catalog. I took selected evidence from the technical data and ordering variant sections, then checked each fact against its source. The catalog assigns an identifier to every passage and stores the module, the section title, and the original product link. This means the backend can map identifiers to real links. If the answer makes a statement about a measured or listed value, you can visit the relevant product page and find the named section.' },
    @{ Image='mobile-answer'; Title='03 / Keep the variant in the answer'; Text='Here is an example from the mobile layout. I asked which L T E bands the C sixteen Q S India variant supports. The answer explicitly names the India variant before giving its bands. The same module family has other regional variants, so a band list without the region could mislead someone. The citation names the technical data section. Another example from the five recorded runs asks whether every C sixteen Q S has e SIM. The answer explains that it depends on the exact ordering code and gives examples pulled from the ordering table.' },
    @{ Image='recommendation'; Title='04 / A recommendation you can check'; Text='Next I asked which module to shortlist for at least twenty megabits per second of published peak downlink. The backend compares the two stored numbers. Cavli lists ten for the C sixteen Q S and one hundred fifty for the C twenty Q M. The latter clears the threshold. The answer labels these as peak figures and asks the visitor to check actual deployment throughput. Both comparison sources are shown. The number next to the assistant is the time measured by the backend for this request. These preview timings are different from hosted response times.' },
    @{ Image='fallback'; Title='05 / Missing evidence'; Text='Here I asked whether a module would work with a custom antenna. The selected public product information cannot verify that configuration. The assistant says so directly and shows a route to the product pages or Cavli support. For questions like this, an engineer needs the exact ordering code and deployment details. Keeping the fallback consistent makes the boundary visible to the customer. A service error is handled separately from a lack of product evidence.' },
    @{ Image='feedback'; Title='06 / Feedback and website handoff'; Text='For review, I marked an answer as having a weak citation. Feedback is tied to an answer identifier and the evidence identifiers it used. The local preview stores feedback on the machine. I separately verified a successful feedback write to the Supabase project. Supabase has ten real embeddings, created with its g t e small model, and pgvector ranks matching passages. The TypeScript backend also adds exact matches for model names and spec terms. That matters because a paraphrased question about e SIM ranked an unrelated location passage above the e SIM passage in a live search. The hosted Gemini path can choose from the combined candidates, and the backend checks the resulting IDs against the evidence. Cloudflare packages the browser UI and backend into one Worker. Its deployment bundle passed the dry run, but deployment and live Gemini verification remain pending. For integration into the website, the UI team can mount the widget and call the same backend while keeping product evidence and feedback review under an assigned owner.' }
)
$folder = Join-Path (Get-Location) 'outputs/private/demo'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$synth.Rate = -2
$clips = @()
try {
  foreach ($chapter in $chapters) {
    $index = $clips.Count + 1
    $wav = Join-Path $folder ("$index.wav")
    $clip = Join-Path $folder ("$index.mp4")
    $displayTitle = Join-Path $folder ("$index.txt")
    $chapterLength = @(48,45,49,52,44,87)[$index-1]
    $synth.SetOutputToWaveFile($wav)
    $synth.Speak($chapter.Text)
    $synth.SetOutputToNull()
    Set-Content -LiteralPath $displayTitle -Value $chapter.Title -Encoding utf8NoBOM -NoNewline
    $image = "outputs/private/$($chapter.Image).png"
    $filter = "scale=1280:660:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(660-ih)/2:color=0xf7f8f5,format=yuv420p,drawbox=x=0:y=660:w=1280:h=60:color=0x224d3b:t=fill,drawtext=fontfile=C\\:/Windows/Fonts/arial.ttf:textfile=outputs/private/demo/$index.txt:fontcolor=white:fontsize=22:x=42:y=678"
    & ffmpeg -loglevel error -y -loop 1 -framerate 10 -i $image -i $wav -vf $filter -af "apad=whole_dur=$chapterLength" -t $chapterLength -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -c:a aac -b:a 96k $clip
    if ($LASTEXITCODE -ne 0) { throw "Could not render chapter $index" }
    $clips += "file '$index.mp4'"
  }
} finally { $synth.Dispose() }
$list = Join-Path $folder 'clips.txt'
Set-Content -LiteralPath $list -Value $clips -Encoding utf8NoBOM
& ffmpeg -loglevel error -y -f concat -safe 0 -i $list -c copy -movflags +faststart outputs/cavli-preview-demo.mp4
if ($LASTEXITCODE -ne 0) { throw 'Could not assemble demo' }
& ffprobe -v error -show_entries format=duration,size -of default=nw=1 outputs/cavli-preview-demo.mp4
