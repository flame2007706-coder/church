import { createRequire } from "node:module";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeNodeModules = "/Users/guoweiming/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(path.join(runtimeNodeModules, "_runtime.js"));
const JSZip = require("jszip");

const sourceDir = path.join(__dirname, "ppt&word");
const outputFile = path.join(__dirname, "song-歌詞.js");

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalize = (value) => String(value || "")
  .replace(/\s+/g, "")
  .replace(/[，。！？、,.!?;；:：()\[\]（）【】「」『』《》〈〉\-—_＋+&＆]/g, "")
  .toLowerCase();

const decodeXml = (value) => String(value || "")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const chunkLines = (lines, size = 4) => {
  const chunks = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks;
};

const splitSegmentsByBlank = (items, getText) => {
  const segments = [];
  let current = [];

  items.forEach((item) => {
    if (getText(item)) {
      current.push(item);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  });

  if (current.length) segments.push(current);
  return segments;
};

const collapsePptMergedLine = (lines) => {
  const safeLines = Array.isArray(lines)
    ? lines.map((line) => cleanText(line)).filter(Boolean)
    : [];
  if (safeLines.length <= 1) return safeLines;

  const [firstLine, ...restLines] = safeLines;
  if (restLines.length >= 2 && normalize(firstLine) === normalize(restLines.join(""))) {
    return restLines;
  }

  return safeLines;
};

const isProbablyNotSong = (lines) => {
  const text = lines.join("");
  if (text.length < 6) return true;
  return [
    "聚會前請將手機",
    "轉為靜音",
    "預備心",
    "奉獻經文",
    "歡迎新朋友",
    "報告事項",
    "主日崇拜程序"
  ].some((item) => text.includes(item));
};

const isGreyTitleParagraph = (paragraphXml, text) => {
  if (!text) return false;
  return Array.from(paragraphXml.matchAll(/<w:shd\b[^>]*>/g)).some(([tag]) => {
    const value = tag.match(/\bw:val="([^"]+)"/)?.[1] || tag.match(/\bval="([^"]+)"/)?.[1] || "";
    const fill = (tag.match(/\bw:fill="([^"]+)"/)?.[1] || tag.match(/\bfill="([^"]+)"/)?.[1] || "").toUpperCase();
    return /^pct\d+$/i.test(value) || ["BFBFBF", "C0C0C0", "D0D0D0", "D9D9D9", "E7E6E6", "EDEDED", "F2F2F2"].includes(fill);
  });
};

const buildDocxSongsFromParagraphs = (paragraphs, fileName) => {
  const hasGreyTitles = paragraphs.some((paragraph) => paragraph.isTitle);

  if (!hasGreyTitles) {
    return splitSegmentsByBlank(paragraphs, (paragraph) => paragraph.text).map((segment, index) => {
      const lines = segment.map((paragraph) => paragraph.text.trim()).filter(Boolean);
      return {
        title: (lines[0] || "未命名歌曲").slice(0, 24),
        source: fileName,
        sourceType: "Word",
        songIndex: index + 1,
        lines,
        slideBlocks: chunkLines(lines)
      };
    }).filter((song) => !isProbablyNotSong(song.lines));
  }

  const songs = [];
  let current = null;
  paragraphs.forEach((paragraph) => {
    if (paragraph.hasPageBreak && current?.lines.length) {
      current.lines.push("");
    }

    if (paragraph.isTitle) {
      if (current?.lines.some(Boolean)) songs.push(current);
      current = {
        title: paragraph.text.slice(0, 24) || "未命名歌曲",
        source: fileName,
        sourceType: "Word",
        songIndex: songs.length + 1,
        lines: [paragraph.text]
      };
      return;
    }

    if (!current || !paragraph.text) return;
    current.lines.push(paragraph.text);
  });

  if (current?.lines.some(Boolean)) songs.push(current);

  return songs.map((song, index) => {
    const lines = song.lines.map((line) => line.trim()).filter(Boolean);
    return {
      ...song,
      songIndex: index + 1,
      lines,
      slideBlocks: chunkLines(lines)
    };
  }).filter((song) => !isProbablyNotSong(song.lines));
};

const extractTagText = (xml, tagName) => {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "g");
  return Array.from(xml.matchAll(pattern), (match) => decodeXml(match[1]));
};

const extractParagraphs = (xml, paragraphTag, textTag) => {
  const paragraphPattern = new RegExp(`<${paragraphTag}[^>]*>([\\s\\S]*?)<\\/${paragraphTag}>`, "g");
  return Array.from(xml.matchAll(paragraphPattern), (match) => {
    return cleanText(extractTagText(match[1], textTag).join(""));
  });
};

const sourceGroupKey = (fileName) => path.basename(fileName)
  .replace(/\.(pptx|docx)$/i, "")
  .replace(/\s+/g, "")
  .replace(/修正/g, "")
  .replace(/[-_－]\d+$/g, "");

const lineMatchScore = (aLines, bLines) => {
  const aText = normalize((aLines || []).join(""));
  const bText = normalize((bLines || []).join(""));
  if (!aText || !bText) return 0;
  const aScore = (aLines || []).reduce((total, line) => {
    const key = normalize(line);
    return total + (key.length >= 3 && bText.includes(key) ? 1 : 0);
  }, 0);
  const bScore = (bLines || []).reduce((total, line) => {
    const key = normalize(line);
    return total + (key.length >= 3 && aText.includes(key) ? 1 : 0);
  }, 0);
  return Math.max(aScore, bScore);
};

const useWordTitlesForMatchingPpts = (songs) => {
  const wordSongs = songs.filter((song) => song.sourceType === "Word");
  return songs.map((song) => {
    if (song.sourceType !== "PPT") return song;
    const groupKey = sourceGroupKey(song.source);
    const best = wordSongs
      .filter((wordSong) => sourceGroupKey(wordSong.source) === groupKey)
      .map((wordSong) => ({
        wordSong,
        score: lineMatchScore(song.lines, wordSong.lines)
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 2) {
      return {
        ...song,
        title: "未對到 Word 歌名"
      };
    }
    return {
      ...song,
      title: best.wordSong.title
    };
  });
};

const readPptxSongs = async (filePath) => {
  const fileName = path.basename(filePath);
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const slidePaths = Object.keys(zip.files)
    .filter((zipPath) => /^ppt\/slides\/slide\d+\.xml$/.test(zipPath))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));
  const slides = [];

  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath).async("text");
    const lines = extractParagraphs(xml, "a:p", "a:t").filter(Boolean);
    slides.push(lines);
  }

  return splitSegmentsByBlank(slides, (slideLines) => slideLines.join("")).map((segment, index) => {
    const slideBlocks = segment
      .map((slideLines) => collapsePptMergedLine(slideLines))
      .filter((slideLines) => slideLines.length);
    const lines = slideBlocks.flat();
    return {
      title: (lines[0] || "未命名歌曲").slice(0, 24),
      source: fileName,
      sourceType: "PPT",
      songIndex: index + 1,
      lines,
      slideBlocks
    };
  }).filter((song) => !isProbablyNotSong(song.lines));
};

const readDocxSongs = async (filePath) => {
  const fileName = path.basename(filePath);
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) return [];

  const xml = await xmlFile.async("text");
  const paragraphPattern = /<w:p[\s\S]*?<\/w:p>/g;
  const paragraphs = Array.from(xml.matchAll(paragraphPattern)).map((match) => {
    const paragraphXml = match[0];
    const text = cleanText(extractTagText(paragraphXml, "w:t").join(""));
    const hasPageBreak = /<w:br[^>]*(w:type="page"|type="page")/.test(paragraphXml);
    return {
      text,
      hasPageBreak,
      isTitle: isGreyTitleParagraph(paragraphXml, text)
    };
  });

  return buildDocxSongsFromParagraphs(paragraphs, fileName);
};

const listSourceFiles = async () => {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("~$") && /\.(pptx|docx)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .map((name) => path.join(sourceDir, name));
};

const buildArchive = async () => {
  const sourceFiles = await listSourceFiles();
  const songs = [];
  const errors = [];

  for (const filePath of sourceFiles) {
    try {
      if (/\.pptx$/i.test(filePath)) {
        songs.push(...await readPptxSongs(filePath));
      } else if (/\.docx$/i.test(filePath)) {
        songs.push(...await readDocxSongs(filePath));
      }
    } catch (error) {
      errors.push(`${path.basename(filePath)}: ${error.message || error}`);
    }
  }

  const titledSongs = useWordTitlesForMatchingPpts(songs);
  const seen = new Set();
  const uniqueSongs = [];
  titledSongs.forEach((song) => {
    const key = normalize((song.lines || []).join("\n"));
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueSongs.push(song);
  });

  const output = `window.ARCHIVE_SONGS = ${JSON.stringify(uniqueSongs)};\n`;
  await writeFile(outputFile, output, "utf8");

  console.log(`掃描檔案：${sourceFiles.length}`);
  console.log(`讀到歌曲：${songs.length}`);
  console.log(`去重後：${uniqueSongs.length}`);
  console.log(`輸出檔案：${outputFile}`);
  if (errors.length) {
    console.log(`讀取失敗：${errors.length}`);
    errors.forEach((error) => console.log(`- ${error}`));
  }
};

buildArchive().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
