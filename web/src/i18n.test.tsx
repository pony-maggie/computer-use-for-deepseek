import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider, LanguageSwitcher, useI18n } from "./i18n";

function Probe() {
  const { t, locale } = useI18n();
  return (
    <div>
      <span>{locale}</span>
      <span>{t("task.label")}</span>
      <span>{t("chat.voiceHelp")}</span>
    </div>
  );
}

describe("i18n", () => {
  it("switches global UI language between Chinese and English", () => {
    render(
      <LanguageProvider initialLocale="zh-CN">
        <LanguageSwitcher />
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByText("zh-CN")).toBeTruthy();
    expect(screen.getByText("任务")).toBeTruthy();
    expect(screen.getByText("语音跟随界面语言")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("界面语言"), {
      target: { value: "en-US" },
    });

    expect(screen.getByText("en-US")).toBeTruthy();
    expect(screen.getByText("Task")).toBeTruthy();
    expect(screen.getByText("Voice follows interface language")).toBeTruthy();
  });
});
