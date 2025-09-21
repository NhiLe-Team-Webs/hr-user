import { supabase } from '../supabaseClient';
import type { LandingPage } from '@/types/landingPage';

const landingPageFallbacks = {
  error_title: 'Co loi xay ra',
  error_subtitle: 'Chung toi dang kiem tra su co. Vui long thu lai sau it phut.',
  error_cta_text: 'Quay ve trang chu',
  error_cta_link: '/',
} as const;

const applyLandingPageFallbacks = (payload: LandingPage): LandingPage => ({
  ...payload,
  error_title: payload.error_title ?? landingPageFallbacks.error_title,
  error_subtitle: payload.error_subtitle ?? landingPageFallbacks.error_subtitle,
  error_cta_text: payload.error_cta_text ?? landingPageFallbacks.error_cta_text,
  error_cta_link: payload.error_cta_link ?? landingPageFallbacks.error_cta_link,
});

export const getLandingPageData = async (): Promise<LandingPage> => {
  const { data, error } = await supabase
    .from('landing_page')
    .select('*')
    .single();

  if (error) {
    console.error('Failed to load landing page data:', error);
    throw new Error('Khong the tai du lieu landing page.');
  }

  return applyLandingPageFallbacks(data as LandingPage);
};

export const updateLandingPageData = async (payload: Partial<LandingPage>): Promise<void> => {
  const { error } = await supabase
    .from('landing_page')
    .update(payload);

  if (error) {
    console.error('Failed to update landing page data:', error);
    throw new Error('Khong the cap nhat landing page.');
  }
};
