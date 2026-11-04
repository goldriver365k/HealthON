/// <reference types="jest" />
import { createMemoryRepository, DEMO_INVITE_CODE } from '../memoryRepository';
import { reducer, type Action } from '../reducer';
import { createSampleState, type AppState } from '../sampleData';
import { adherenceSummary } from '../selectors';
import { scopeArgs, toFamilyLink, toSharedSummary } from '../supabase/mappers';
import { familyLinkTitle } from '@/utils/labels';

const now = new Date(2026, 10, 4, 9, 0);

describe('가족 공유 데이터 변환 (서버 → 앱)', () => {
  const row = {
    id: 'L1', owner_id: 'C', viewer_id: 'D', relation_label: '딸', owner_label: '어머니',
    share_bp: true, share_glucose: false, share_weight: false, share_intakes: true, share_appointments: false,
    status: 'active', consented_at: '2026-11-01T00:00:00Z', revoked_at: null,
  };
  it('주인 쪽에서는 내가 부르는 호칭(딸)과 열람 횟수', () => {
    const l = toFamilyLink(row, 'C', { count: 3, last: '2026-11-04T00:00:00Z' });
    expect([l.role, l.personName, l.viewCount7d, familyLinkTitle(l)]).toEqual(['owner', '딸', 3, '딸']);
  });
  it('보는 가족 쪽에서는 주인이 정한 호칭(어머니), 열람 횟수 없음', () => {
    const l = toFamilyLink(row, 'D');
    expect([l.role, l.personName, l.viewCount7d]).toEqual(['viewer', '어머니', undefined]);
  });
  it('공유 요약: 서버가 준 항목만, 약 이름 없이 시간대 표시', () => {
    const s = toSharedSummary('L1', {
      bp: [{ measured_at: 't', systolic: 131, diastolic: 85 }],
      intakes_today: [{ slot: 'evening', time_of_day: '18:30', taken: false }],
    });
    expect(s?.recentBp).toEqual([{ measuredAt: 't', systolic: 131, diastolic: 85 }]);
    expect(s?.todayIntakes).toEqual([{ label: '저녁 약 (오후 6:30)', taken: false }]);
    expect(s?.recentGlucose).toBeUndefined();
    expect(s?.nextAppointment).toBeUndefined();
  });
  it('공유가 멈추면(null) 요약 없음', () => expect(toSharedSummary('L1', null)).toBeNull());
  it('공유 범위 → 서버 함수 인자', () =>
    expect(scopeArgs({ bp: true, glucose: false, weight: false, intakes: true, appointments: false })).toEqual({
      p_share_bp: true, p_share_glucose: false, p_share_weight: false, p_share_intakes: true, p_share_appointments: false,
    }));
});

describe('체험 모드 가족 초대', () => {
  function setup() {
    let state: AppState = createSampleState(now);
    const dispatch = (a: Action) => {
      state = reducer(state, a);
    };
    return { repo: createMemoryRepository(dispatch), get: () => state };
  }
  it('초대 코드는 123456', async () => {
    const { repo } = setup();
    const r = await repo.createFamilyInvite({ relationLabel: '딸', ownerLabel: '어머니', scope: { bp: true, glucose: false, weight: false, intakes: false, appointments: false } });
    expect(r.code).toBe(DEMO_INVITE_CODE);
  });
  it('맞는 코드 → 예시 가족 연결 + 요약', async () => {
    const { repo, get } = setup();
    const before = get().familyLinks.length;
    await repo.acceptFamilyInvite('123 456');
    expect(get().familyLinks.length).toBe(before + 1);
    const link = get().familyLinks[get().familyLinks.length - 1];
    expect(link.source).toBe('sample');
    expect(get().sharedSummaries.some((s) => s.linkId === link.id)).toBe(true);
  });
  it('틀린 코드 → 한국어 오류', async () => {
    const { repo } = setup();
    await expect(repo.acceptFamilyInvite('000000')).rejects.toThrow('코드가 맞지 않거나');
  });
});

describe('공유 요약 갱신 (reducer)', () => {
  it('summary/set null → 요약 삭제', () => {
    const s = createSampleState(now);
    const a = reducer(s, { type: 'summary/set', linkId: 's-link-3', summary: null });
    expect(a.sharedSummaries.some((x) => x.linkId === 's-link-3')).toBe(false);
  });
});

describe('약 확인 요약 (횟수만, 평가 없음)', () => {
  const s = createSampleState(now);
  it('최근 7일 합계와 약별 현황', () => {
    const a = adherenceSummary(s, 7, now);
    // 예시: 매일 4번(아침2·점심1·저녁1) × 7일 = 28번, 오늘은 아침 2개만, 지난 6일 중 하루 저녁 빠짐 → 2 + 6×4 - 1 = 25
    expect([a.total, a.taken]).toEqual([28, 25]);
    expect(a.perMedication.map((m) => [m.name, m.total, m.taken])).toEqual([
      ['혈압약(예시)', 7, 7],
      ['당뇨약(예시)', 14, 12],
      ['영양제(예시)', 7, 6],
    ]);
    expect(a.daily).toHaveLength(7);
    expect(a.daily[6].value).toBe(2); // 오늘
  });
  it('그만 먹는 약은 빠짐', () => {
    const b = reducer(s, { type: 'medication/active', id: 's-med-3', isActive: false });
    expect(adherenceSummary(b, 7, now).perMedication).toHaveLength(2);
  });
});
