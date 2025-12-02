import { apiClient } from '@/lib/httpClient';
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

interface BackendLandingPageResponse {
  success: boolean;
  data: {
    content: LandingPage;
  };
}

export const getLandingPageData = async (): Promise<LandingPage> => {
  try {
    const response = await apiClient.get<BackendLandingPageResponse>('/hr/landing-page');

    if (response.success && response.data?.content) {
      return applyLandingPageFallbacks(response.data.content);
    }

    throw new Error('Invalid response from backend');
  } catch (error) {
    console.error('Failed to load landing page data via backend:', error);
    throw new Error('Khong the tai du lieu landing page.');
  }
};
