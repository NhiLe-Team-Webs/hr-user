export interface LandingPage {
  id: number;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_cta_text?: string | null;
  hero_cta_link?: string | null;
  core_values?: string[] | null;
  how_it_works_title?: string | null;
  how_it_works_subtitle?: string | null;
  how_it_works_steps?: LandingPageStep[] | null;
  stats?: LandingPageStat[] | null;
  volunteer_title?: string | null;
  volunteer_text?: string | null;
  volunteer_cta_text?: string | null;
  volunteer_cta_link?: string | null;
  vocational_title?: string | null;
  vocational_text?: string | null;
  vocational_cta_text?: string | null;
  vocational_cta_link?: string | null;
  error_title?: string | null;
  error_subtitle?: string | null;
  error_cta_text?: string | null;
  error_cta_link?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface LandingPageStep {
  title?: string | null;
  description?: string | null;
}

export interface LandingPageStat {
  value?: string | null;
  title?: string | null;
  description?: string | null;
}
