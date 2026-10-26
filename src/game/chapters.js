// Chapter select, for testing: the start of each part of the story. Every
// state is a save the automated walkthrough recorded as it reached that point
// (tools/walkthrough), so each door, item and flag before it is just as a
// real playthrough left it. The first chapter is simply a new game.
import STATES from './chapters.json';

export const CHAPTERS = [
  { id: 'storm', title: '第一幕　嵐の夜', place: '屋根裏部屋' },
  { id: 'downstairs', title: '第一幕　階下へ', place: '玄関ホール' },
  { id: 'cellar', title: '第一幕　地下の祭壇', place: '地下室' },
  { id: 'tide', title: '第二幕　潮の夜', place: '玄関ホール' },
  { id: 'west', title: '第二幕　西翼', place: '肖像画の回廊' },
  { id: 'east', title: '第二幕　東翼と塔', place: '使用人棟' },
  { id: 'grave', title: '第二幕　子供部屋と墓地', place: '二階廊下' },
  { id: 'sea', title: '第二幕　海の洞窟', place: '潮の洞窟' },
  { id: 'abyss', title: '第二幕　深淵の祭殿', place: '深淵の祭殿' },
].map((c) => ({ ...c, state: STATES[c.id] || null }));
