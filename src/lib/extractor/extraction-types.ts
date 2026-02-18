export type CapturedNode = {
  selector: string;
  tag: string;
  role: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, string>;
};

export type ExtractedSection = {
  selector: string;
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: string[];
};

export type ExtractionSnapshot = {
  title: string;
  bodyText: string;
  htmlSnippet: string;
  viewport: { width: number; height: number };
  headings: string[];
  buttons: string[];
  navItems: string[];
  nodes: CapturedNode[];
  prominentNodes: CapturedNode[];
  sections: ExtractedSection[];
  rootCssVars: Record<string, string>;
  assets: {
    images: Array<{ url: string; selector: string }>;
    fonts: Array<{ family: string; source: string }>;
    icons: Array<{ url: string; rel: string }>;
  };
};

export type Weighted<T> = {
  value: T;
  weight: number;
  source?: string;
};
