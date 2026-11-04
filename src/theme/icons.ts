import type { SymbolViewProps } from 'expo-symbols';

/**
 * 앱에서 쓰는 아이콘 목록 (expo-symbols: iOS = SF Symbols, Android/웹 = Material Symbols).
 * 화면에서는 이 이름만 사용한다. 아이콘만 있는 버튼은 만들지 않는다(항상 글자와 함께).
 */
export const icons = {
  today: { ios: 'house', android: 'home', web: 'home' },
  records: { ios: 'heart.text.square', android: 'monitor_heart', web: 'monitor_heart' },
  meds: { ios: 'pills', android: 'medication', web: 'medication' },
  family: { ios: 'person.2', android: 'family_restroom', web: 'family_restroom' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  done: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  todo: { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  hospital: { ios: 'cross.case', android: 'local_hospital', web: 'local_hospital' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  delete: { ios: 'trash', android: 'delete', web: 'delete' },
  bp: { ios: 'heart', android: 'favorite', web: 'favorite' },
  glucose: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  weight: { ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' },
  call: { ios: 'phone.fill', android: 'call', web: 'call' },
  emergency: { ios: 'cross.case.fill', android: 'emergency', web: 'emergency' },
  invite: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  next: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof icons;
