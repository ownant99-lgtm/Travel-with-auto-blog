// 어떤 형태로 들어오든 항상 "gemini-xxx" 형태로 정규화 (models/ 접두사 제거)
function normalizeModelName(model: string) {
  return model.replace(/^models\//, "").trim();
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 프로젝트 설정 > Environment Variables에 GEMINI_API_KEY를 추가해주세요.",
    );
  }

  const configuredModel = normalizeModelName(
    process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  );
  const candidateModels = Array.from(
    new Set(
      [
        configuredModel,
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
      ].map(normalizeModelName),
    ),
  );

  const apiVersion: GeminiApiVersion = "v1beta";

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

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastErrorText = errorText;

      const isModelNotFound =
        response.status === 404 &&
        /not found|not supported|not available/i.test(errorText);

      if (isModelNotFound) {
        console.warn(`[gemini] model not found, trying next: ${model}`);
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

  throw new Error(
    `Gemini 호출에 실패했습니다. 요청한 모델을 찾지 못했습니다: ${lastErrorText || "사용 가능한 Flash 계열 모델을 찾지 못했습니다."}`,
  );
}
