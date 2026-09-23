import { describe, expect, it } from 'vitest';
import { sanitizePastedHtml } from '@/lib/noteHtml';

describe('sanitizePastedHtml（便签粘贴清洗）', () => {
  it('剥掉内联样式：从深色网页粘来的黑底白字不再落库', () => {
    const out = sanitizePastedHtml(
      '<span style="background-color: rgb(0, 0, 0); color: rgb(255, 255, 255);">黑底文字</span>',
    );
    expect(out).toBe('黑底文字');
    expect(out).not.toMatch(/style|background|color/i);
  });

  it('保留便签支持的结构标签，其余属性一律剥掉', () => {
    expect(sanitizePastedHtml('<h1 class="t">标题</h1><p><b style="font-weight:400">粗</b></p>')).toBe(
      '<h1>标题</h1><p><b>粗</b></p>',
    );
    expect(sanitizePastedHtml('<div style="font-size:40px">大</div>')).toBe('<div>大</div>');
  });

  it('script / style 连内容一起丢弃', () => {
    expect(sanitizePastedHtml('前<script>alert(1)</script>后')).toBe('前后');
    expect(sanitizePastedHtml('<style>.a{color:red}</style>正文')).toBe('正文');
  });

  it('链接只留安全的 href，javascript: 剥掉', () => {
    expect(sanitizePastedHtml('<a href="https://x.com/a?b=1" onclick="x()">链</a>')).toBe(
      '<a href="https://x.com/a?b=1">链</a>',
    );
    expect(sanitizePastedHtml('<a href="mailto:a@b.com">邮</a>')).toBe('<a href="mailto:a@b.com">邮</a>');
    expect(sanitizePastedHtml('<a href="javascript:alert(1)">危</a>')).toBe('<a>危</a>');
  });

  it('不支持的标签拆壳留字，图片之类直接丢掉', () => {
    expect(sanitizePastedHtml('<table><tr><td>格子</td></tr></table>')).toBe('格子');
    expect(sanitizePastedHtml('<img src="https://x.com/a.png" />文字')).toBe('文字');
  });

  it('属性值里的 > 不会截断标签', () => {
    expect(sanitizePastedHtml('<a title="a>b" href="https://x.com">x</a>')).toBe(
      '<a href="https://x.com">x</a>',
    );
  });

  it('换行归一成 <br>，注释丢弃', () => {
    expect(sanitizePastedHtml('甲<br/>乙<br>丙')).toBe('甲<br>乙<br>丙');
    expect(sanitizePastedHtml('甲<!-- 注释 -->乙')).toBe('甲乙');
  });

  it('无标签的纯文本原样返回', () => {
    expect(sanitizePastedHtml('随手记一行')).toBe('随手记一行');
  });
});
