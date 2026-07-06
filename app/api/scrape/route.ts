import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_SCRAPED_TEXT_LENGTH = 5000;

type GuidelineInput = {
  courseOrder: string;
  meetingInfo: string;
  differentiators: string;
  price: string;
};

type BlogResult = {
  title: string;
  content: string;
  hashtags: string;
  copyText: string;
};

type ScrapedContent = {
  pageTitle: string;
  bodyText: string;
};

type GeminiApiVersion = "v1" | "v1beta";

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );
}

function stripTags(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function getTagContent(html: string, tagName: string) {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );

  return match ? stripTags(match[1]) : "";
}

function getMetaContent(html: string, name: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }

  return "";
}

function getBodyText(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : html;

  return stripTags(source);
}

function shortenText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function sanitizeGuideline(input: unknown): GuidelineInput {
  const data = typeof input === "object" && input ? input : {};

  return {
    courseOrder:
      typeof (data as GuidelineInput).courseOrder === "string"
        ? (data as GuidelineInput).courseOrder.trim()
        : "",
    meetingInfo:
      typeof (data as GuidelineInput).meetingInfo === "string"
        ? (data as GuidelineInput).meetingInfo.trim()
        : "",
    differentiators:
      typeof (data as GuidelineInput).differentiators === "string"
        ? (data as GuidelineInput).differentiators.trim()
        : "",
    price:
      typeof (data as GuidelineInput).price === "string"
        ? (data as GuidelineInput).price.trim()
        : "",
  };
}

async function scrapeTravelProduct(url: URL): Promise<ScrapedContent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; TravelSellerBot/2.0; +https://example.com/bot)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(
      "웹페이지를 불러오지 못했습니다. 접근 가능한 URL인지 확인해주세요.",
    );
  }

  const html = await response.text();
  const pageTitle =
    getTagContent(html, "title") ||
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title") ||
    "상품 제목을 찾지 못했어요";

  const bodyText = shortenText(
    getMetaContent(html, "description") ||
      getMetaContent(html, "og:description") ||
      getMetaContent(html, "twitter:description") ||
      getBodyText(html),
    MAX_SCRAPED_TEXT_LENGTH,
  );

  if (!bodyText) {
    throw new Error("본문 텍스트를 추출하지 못했습니다.");
  }

  return {
    pageTitle,
    bodyText,
  };
}

function buildAiPrompt({
  url,
  scraped,
  guideline,
}: {
  url: string;
  scraped: ScrapedContent;
  guideline: GuidelineInput;
}) {
  return `
당신은 네이버 블로그용 여행 마케팅 포스팅을 작성하는 한국어 카피라이터입니다.

[최우선 규칙]
- 타사 URL 데이터는 풍성한 묘사, 표현, 글감 참고용으로만 사용하세요.
- 실제 블로그 글의 핵심 뼈대는 반드시 사용자가 직접 입력한 정보가 100% 최우선입니다.
- 코스 순서, 출발 시간/미팅 장소, 차별화 혜택, 판매 가격은 사용자가 준 값을 임의 변경하거나 타사 정보로 덮어쓰면 안 됩니다.
- 타사 페이지에 다른 가격, 다른 동선, 다른 혜택이 있더라도 그대로 옮기지 말고 사용자 가이드라인 기준으로 재창조하세요.
- 결과는 네이버 블로그에 바로 붙여 넣을 수 있는 자연스러운 장문 마케팅 글이어야 합니다.

[출력 형식]
- 반드시 JSON 하나만 출력하세요.
- JSON 스키마:
{
  "title": "문자열",
  "content": "문자열",
  "hashtags": "문자열"
}

[글 구조]
- 제목
- 도입부: 일본 여행 필수 코스 추천 느낌으로 시작
- 상세 코스 소개: 사용자가 준 코스 진행 순서를 기준으로 설명
- 가격 및 혜택 요약: 사용자가 준 판매 가격과 차별화 혜택을 강조
- 맺음말
- 해시태그는 한 줄 문자열로 8~12개

[품질 기준]
- 본문은 1,000자 이상
- 문단을 여러 개로 나누고, 각 문단 사이에는 빈 줄이 들어가도록 content에 "\\n\\n" 사용
- 과도한 이모지는 쓰지 말고, 판매용 블로그 문체로 자연스럽게 작성
- 허위 정보, 확인되지 않은 숫자, 임의의 운영 정보는 만들지 말 것
- 사용자가 입력한 미팅 장소, 출발 시간, 가격은 정확히 반영할 것

[사용자 가이드라인]
- 코스 진행 순서: ${guideline.courseOrder}
- 출발 시간 및 미팅 장소: ${guideline.meetingInfo}
- 우리 상품만의 차별화 혜택: ${guideline.differentiators}
- 정확한 판매 가격: ${guideline.price}

[참고용 타사 URL 정보]
- URL: ${url}
- 타이틀: ${scraped.pageTitle}
- 본문 참고 텍스트:
${scraped.bodyText}
`.trim();
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON 형식을 찾지 못했습니다.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeHashtags(raw: string) {
  const words = raw
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => (word.startsWith("#") ? word : `#${word}`));

  return Array.from(new Set(words)).join(" ");
}

function toBlogResult(data: {
  title: string;
  content: string;
  hashtags: string;
}): BlogResult {
  const title = data.title.trim();
  const content = data.content.trim();
  const hashtags = normalizeHashtags(data.hashtags.trim());

  return {
    title,
    content,
    hashtags,
    copyText: `${title}\n\n${content}\n\n${hashtags}`,
  };
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트에 `.env.local` 또는 `.env` 파일을 만들고 `GEMINI_API_KEY=발급받은키` 형식으로 추가해주세요.",
    );
  }

  const configuredModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const candidateModels = Array.from(
    new Set([
      configuredModel,
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ]),
  );
  const candidateVersions: GeminiApiVersion[] = ["v1", "v1beta"];
  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: "당신은 네이버 블로그용 한국어 여행 마케팅 글을 작성하는 카피라이터이며, 반드시 JSON만 반환합니다.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2200,
      responseMimeType: "application/json",
    },
  };

  let lastErrorText = "";

  for (const apiVersion of candidateVersions) {
    for (const model of candidateModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        lastErrorText = errorText;

        const isModelNotFound =
          response.status === 404 &&
          /not found|not supported|not available/i.test(errorText);

        if (isModelNotFound) {
          continue;
        }

        throw new Error(`Gemini 호출에 실패했습니다: ${errorText}`);
      }

      const data = await response.json();
      const output =
        data.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("") ?? "";

      if (!output.trim()) {
        throw new Error(
          "Gemini가 비어 있는 응답을 반환했습니다. 프롬프트 또는 API 사용량 제한을 확인해주세요.",
        );
      }

      return output;
    }
  }

  throw new Error(
    `Gemini 호출에 실패했습니다. 요청한 모델을 찾지 못했습니다: ${lastErrorText || "사용 가능한 Flash 계열 모델을 찾지 못했습니다."}`,
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const guideline = sanitizeGuideline(body.guideline);

    if (!rawUrl) {
      return NextResponse.json(
        { message: "URL을 먼저 입력해주세요." },
        { status: 400 },
      );
    }

    if (
      !guideline.courseOrder ||
      !guideline.meetingInfo ||
      !guideline.differentiators ||
      !guideline.price
    ) {
      return NextResponse.json(
        {
          message:
            "코스 진행 순서, 출발 시간 및 미팅 장소, 차별화 혜택, 정확한 판매 가격을 모두 입력해주세요.",
        },
        { status: 400 },
      );
    }

    let targetUrl: URL;

    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { message: "올바른 URL 형식이 아닙니다." },
        { status: 400 },
      );
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json(
        { message: "http 또는 https 주소만 사용할 수 있습니다." },
        { status: 400 },
      );
    }

    const scraped = await scrapeTravelProduct(targetUrl);

    // 중요:
    // 외부 페이지의 정보는 "묘사 참고용"으로만 사용하고,
    // 실제 글의 뼈대는 판매자가 입력한 가이드라인을 100% 우선 반영한다.
    const prompt = buildAiPrompt({
      url: targetUrl.toString(),
      scraped,
      guideline,
    });
    const rawAiText = await callGemini(prompt);
    const parsed = extractJsonObject(rawAiText);
    const result = toBlogResult({
      title: String(parsed.title ?? ""),
      content: String(parsed.content ?? ""),
      hashtags: String(parsed.hashtags ?? ""),
    });

    if (result.content.replace(/\s/g, "").length < 1000) {
      throw new Error(
        "Gemini 응답 본문이 너무 짧습니다. 더 긴 포스팅이 나오도록 다시 시도해주세요.",
      );
    }

    return NextResponse.json({
      scraped,
      result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "블로그 글을 생성하는 중 문제가 생겼습니다. 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
