"use client";

import { ChangeEvent, KeyboardEvent, useMemo, useRef, useState } from "react";

type BlogResult = {
  title: string;
  content: string;
  hashtags: string;
  copyText: string;
};

type GuidelineForm = {
  courseOrder: string;
  meetingInfo: string;
  differentiators: string;
  price: string;
};

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [guideline, setGuideline] = useState<GuidelineForm>({
    courseOrder: "",
    meetingInfo: "",
    differentiators: "",
    price: "",
  });
  const [result, setResult] = useState<BlogResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const resultRef = useRef<HTMLDivElement | null>(null);

  const paragraphs = useMemo(
    () =>
      result?.content
        .split("\n\n")
        .map((paragraph) => paragraph.trim())
        .filter(Boolean) ?? [],
    [result],
  );

  const handleGenerate = async () => {
    if (isLoading) {
      return;
    }

    if (!productUrl.trim()) {
      setErrorMessage("먼저 여행 상품 URL을 입력해주세요.");
      setResult(null);
      return;
    }

    if (
      !guideline.courseOrder.trim() ||
      !guideline.meetingInfo.trim() ||
      !guideline.differentiators.trim() ||
      !guideline.price.trim()
    ) {
      setErrorMessage(
        "내 상품 맞춤 가이드라인 4가지를 모두 입력해야 정확한 블로그 글을 만들 수 있어요.",
      );
      setResult(null);
      return;
    }

    setIsLoading(true);
    setIsCopied(false);
    setResult(null);
    setErrorMessage("");

    try {
      const [response] = await Promise.all([
        fetch("/api/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: productUrl,
            guideline,
          }),
        }),
        new Promise((resolve) => {
          window.setTimeout(resolve, 3000);
        }),
      ]);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "블로그 글 초안을 불러오지 못했습니다.",
        );
      }

      setResult(data.result);

      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "블로그 글을 생성하는 중 문제가 생겼습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.copyText) {
      return;
    }

    try {
      await copyToClipboard(result.copyText);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setErrorMessage("복사에 실패했어요. 다시 한 번 시도해주세요.");
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const handleGuidelineChange =
    (field: keyof GuidelineForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setGuideline((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f6f9fc] px-6 py-16 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(49,130,246,0.14),_transparent_34%),linear-gradient(180deg,_#f9fbff_0%,_#f3f6fb_100%)]" />

      <section className="relative z-10 mx-auto w-full max-w-4xl rounded-[32px] border border-white/70 bg-white/88 px-6 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:px-10 md:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-[#eaf2ff] px-4 py-2 text-sm font-semibold text-[#3182f6]">
            여행 셀러 자동화 SaaS
          </span>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#191f28] md:text-5xl">
            여행 상품 URL만 넣으면
            <br />
            네이버 블로그용 글 초안을 길게 생성해요
          </h1>

          <p className="mt-4 text-base leading-7 text-[#6b7684] md:text-lg">
            판매할 여행 상품 링크를 붙여 넣고, 클릭 한 번으로
            <br className="hidden md:block" />
            바로 복사해서 쓸 수 있는 블로그 포스팅 형태를 확인해보세요.
          </p>

          <div className="mt-10 rounded-[32px] border border-[#e6edf5] bg-[#fbfdff] p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:p-6">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-[#e9eef5] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <label htmlFor="product-url" className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#4e5968]">
                    여행 상품 URL
                  </span>
                  <input
                    id="product-url"
                    type="url"
                    value={productUrl}
                    onChange={(event) => setProductUrl(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="여행 상품 URL을 입력해주세요"
                    className="h-16 w-full rounded-2xl border border-[#dbe2ea] bg-[#f9fafb] px-5 text-base text-[#191f28] outline-none transition placeholder:text-[#a0acb8] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-[#3182f6]/15"
                  />
                </label>
              </div>

              <div className="rounded-[28px] border border-[#e9eef5] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:p-6">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-base font-bold text-[#191f28]">
                      내 상품 맞춤 가이드라인
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6b7684]">
                      타사 페이지는 글감으로만 참고하고, 아래 정보가 실제 글의
                      핵심 기준이 됩니다.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-semibold text-[#3182f6]">
                    셀러 직접 통제 영역
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4e5968]">
                      코스 진행 순서
                    </span>
                    <input
                      type="text"
                      value={guideline.courseOrder}
                      onChange={handleGuidelineChange("courseOrder")}
                      placeholder="예시 - 다자이후 -> 유후인 -> 벳부"
                      className="h-14 w-full rounded-2xl border border-[#dbe2ea] bg-[#f9fafb] px-4 text-[15px] text-[#191f28] outline-none transition placeholder:text-[#a0acb8] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-[#3182f6]/15"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4e5968]">
                      출발 시간 및 미팅 장소
                    </span>
                    <input
                      type="text"
                      value={guideline.meetingInfo}
                      onChange={handleGuidelineChange("meetingInfo")}
                      placeholder="예시 - 오전 8:30 하카타역 오리엔탈 호텔 앞"
                      className="h-14 w-full rounded-2xl border border-[#dbe2ea] bg-[#f9fafb] px-4 text-[15px] text-[#191f28] outline-none transition placeholder:text-[#a0acb8] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-[#3182f6]/15"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4e5968]">
                      우리 상품만의 차별화 혜택
                    </span>
                    <textarea
                      value={guideline.differentiators}
                      onChange={handleGuidelineChange("differentiators")}
                      placeholder="예시 - 전문 한국인 가이드 동행, 자체 제작 맛집 지도 증정"
                      rows={4}
                      className="w-full rounded-2xl border border-[#dbe2ea] bg-[#f9fafb] px-4 py-4 text-[15px] leading-7 text-[#191f28] outline-none transition placeholder:text-[#a0acb8] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-[#3182f6]/15"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4e5968]">
                      정확한 판매 가격
                    </span>
                    <input
                      type="text"
                      value={guideline.price}
                      onChange={handleGuidelineChange("price")}
                      placeholder="예시 - 성인 49,000원"
                      className="h-14 w-full rounded-2xl border border-[#dbe2ea] bg-[#f9fafb] px-4 text-[15px] text-[#191f28] outline-none transition placeholder:text-[#a0acb8] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-[#3182f6]/15"
                    />
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isLoading}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#3182f6] px-5 text-lg font-semibold text-white shadow-[0_18px_36px_rgba(49,130,246,0.28)] transition hover:bg-[#1f6fe5] focus:outline-none focus:ring-4 focus:ring-[#3182f6]/25 disabled:cursor-not-allowed disabled:bg-[#8ab7fb] disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    생성 중...
                  </>
                ) : (
                  "블로그 글 생성하기"
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-[#ffd8d6] bg-[#fff8f7] px-5 py-4 text-left">
              <p className="text-sm font-semibold text-[#d14343]">
                {errorMessage}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="mt-8 rounded-3xl border border-[#dce7f8] bg-[#f8fbff] px-6 py-7 text-left shadow-[0_10px_30px_rgba(49,130,246,0.08)]">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3182f6] [animation-delay:-0.3s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3182f6] [animation-delay:-0.15s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#3182f6]" />
                </div>
                <p className="text-sm font-semibold text-[#3182f6] md:text-base">
                  Gemini가 타사 페이지를 읽고, 맞춤 가이드라인 기준으로 블로그 글을 작성하고 있어요.
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#6b7684]">
                잠시만 기다려 주세요. 스크래핑한 정보는 글감으로만 참고하고,
                입력한 순서·시간·혜택·가격을 우선 반영해 장문 포스팅으로
                정리하고 있어요.
              </p>
            </div>
          )}

          {result && (
            <div ref={resultRef} className="mt-10 text-left">
              <div className="overflow-hidden rounded-[32px] border border-[#dfe7f2] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-4 border-b border-[#edf2f7] bg-[#f8fbff] px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#3182f6]">
                      블로그 글 미리보기
                    </p>
                    <p className="mt-1 text-sm text-[#6b7684]">
                      스마트에디터에 붙여 넣기 전, 완성된 본문 형태를 그대로
                      확인해보세요.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#3182f6] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(49,130,246,0.22)] transition hover:bg-[#1f6fe5] focus:outline-none focus:ring-4 focus:ring-[#3182f6]/20"
                  >
                    {isCopied
                      ? "복사 완료! 바로 붙여넣기 하세요"
                      : "블로그 본문 전체 복사하기"}
                  </button>
                </div>

                <div className="bg-[#f3f5f7] px-4 py-4 md:px-6">
                  <div className="rounded-[28px] border border-[#d9e1ea] bg-white px-5 py-6 md:px-8 md:py-8">
                    <div className="flex items-center gap-2 border-b border-dashed border-[#e5ebf2] pb-4">
                      <span className="inline-flex h-3 w-3 rounded-full bg-[#ff6b6b]" />
                      <span className="inline-flex h-3 w-3 rounded-full bg-[#ffd166]" />
                      <span className="inline-flex h-3 w-3 rounded-full bg-[#4cd964]" />
                      <p className="ml-2 text-sm font-medium text-[#6b7684]">
                        네이버 블로그 스마트에디터 미리보기
                      </p>
                    </div>

                    <article className="pt-6">
                      <h2 className="text-[28px] font-bold leading-[1.45] tracking-tight text-[#191f28] md:text-[34px]">
                        {result.title}
                      </h2>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#8b95a1]">
                        <span>여행 상품 소개 초안</span>
                        <span className="h-1 w-1 rounded-full bg-[#c7d0db]" />
                        <span>바로 복사 가능</span>
                        <span className="h-1 w-1 rounded-full bg-[#c7d0db]" />
                        <span>장문 포스팅 포맷</span>
                        <span className="h-1 w-1 rounded-full bg-[#c7d0db]" />
                        <span>가이드라인 우선 반영</span>
                      </div>

                      <div className="mt-8 space-y-5">
                        {paragraphs.map((paragraph, index) => (
                          <p
                            key={`${paragraph.slice(0, 24)}-${index}`}
                            className="whitespace-pre-line text-[17px] leading-[2.05] text-[#3c4653]"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      <div className="mt-8 rounded-2xl bg-[#f8fbff] px-5 py-5">
                        <p className="text-sm font-semibold text-[#3182f6]">
                          해시태그 모음
                        </p>
                        <p className="mt-3 whitespace-pre-line text-base font-semibold leading-8 text-[#191f28]">
                          {result.hashtags}
                        </p>
                      </div>
                    </article>
                  </div>
                </div>

                <div className="border-t border-[#edf2f7] bg-white px-6 py-5">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-[#d6e3fb] bg-[#eef5ff] text-base font-semibold text-[#1f6fe5] transition hover:bg-[#e4efff] focus:outline-none focus:ring-4 focus:ring-[#3182f6]/15"
                  >
                    {isCopied
                      ? "복사 완료! 네이버 블로그에 붙여넣어 보세요"
                      : "블로그 본문 전체 복사하기"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
