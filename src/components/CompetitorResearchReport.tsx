'use client';

import { createContext, useContext, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  ImageOff,
  Lightbulb,
  Loader2,
  MessageCircle,
  Music2,
  Palette,
  Sparkles,
  Target,
  TrendingUp,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authedFetchJson } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';
import { PlatformIcon, Pill, SectionCard, formatCount, httpUrl } from '@/components/CompetitorResearchShared';
import type { PostIdea, RankedPost, ResearchReport } from '@/lib/competitor-research/types';

type Tab = 'ideas' | 'posts' | 'working' | 'benchmarks';

// Refs of the post cards shown in this report
const PostRefs = createContext<Set<string>>(new Set());

// Links "P3"-style post refs in the model's text to the post cards. Refs to
// posts that aren't in the report stay plain text.
function WithRefs({ text, onRef }: { text: string; onRef?: (ref: string) => void }) {
  const refs = useContext(PostRefs);
  const parts = text.split(/\b(P\d{1,2})\b/);
  return (
    <>
      {parts.map((part, i) =>
        refs.has(part) ? (
          <button
            key={i}
            type="button"
            onClick={() => onRef?.(part)}
            className="rounded px-0.5 font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const RefNav = createContext<(ref: string) => void>(() => undefined);
function Refs({ text }: { text: string }) {
  return <WithRefs text={text} onRef={useContext(RefNav)} />;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── Post idea ────────────────────────────────────────────────────────────────

function IdeaCard({ clientId, reportId, idea, index }: { clientId: string; reportId: string; idea: PostIdea; index: number }) {
  const initial = idea.hashtags.length ? `${idea.caption}\n\n${idea.hashtags.join(' ')}` : idea.caption;
  const [caption, setCaption] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy didn’t work — select the text and copy it manually');
    }
  };

  const addToCalendar = async () => {
    setAdding(true);
    setError(null);
    try {
      await authedFetchJson(`/api/clients/${clientId}/competitor-research/reports/${reportId}/ideas`, {
        method: 'POST',
        body: { index, caption },
      });
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t add it to the calendar');
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex flex-wrap items-center gap-1.5">
        {idea.format && <Pill className="bg-blue-50 capitalize text-blue-700 ring-blue-100">{idea.format}</Pill>}
        {idea.platform && <Pill className="bg-gray-100 capitalize text-gray-700 ring-gray-200">{idea.platform}</Pill>}
      </div>
      <h4 className="mt-2 text-[15px] font-semibold leading-5 text-gray-900">{idea.title}</h4>

      <dl className="mt-2.5 space-y-1.5 text-[13px] leading-5">
        {idea.visual_direction && (
          <div>
            <dt className="inline font-medium text-gray-900">Shoot: </dt>
            <dd className="inline text-gray-600">{idea.visual_direction}</dd>
          </div>
        )}
        {idea.hook && (
          <div>
            <dt className="inline font-medium text-gray-900">Hook: </dt>
            <dd className="inline text-gray-600">{idea.hook}</dd>
          </div>
        )}
      </dl>

      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        aria-label={`Caption for ${idea.title}`}
        className="mt-3 min-h-[128px] w-full rounded-xl border border-input bg-gray-50/50 px-3 py-2.5 text-[13px] leading-5 text-gray-800 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-gray-300 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-primary/15"
      />
      {idea.inspired_by && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          Inspired by <Refs text={idea.inspired_by} />
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Button size="sm" variant="outline" className="rounded-lg text-[13px]" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" className="rounded-lg text-[13px]" onClick={addToCalendar} disabled={adding || added || !caption.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : added ? <Check className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
          {added ? 'Added to calendar' : 'Add to calendar'}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </article>
  );
}

// ── Competitor post ──────────────────────────────────────────────────────────

function PostCard({
  post,
  analysis,
  highlighted,
}: {
  post: RankedPost;
  analysis?: ResearchReport['top_posts'][number];
  highlighted: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const link = httpUrl(post.url);
  return (
    <article
      id={`post-${post.ref}`}
      className={cn(
        'flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover',
        highlighted ? 'border-blue-300 ring-[3px] ring-blue-500/15' : 'border-gray-200/80'
      )}
    >
      <div className="relative aspect-square bg-gray-100">
        {post.image_url && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt={`Post by @${post.handle}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
            <ImageOff className="h-5 w-5" />
            <span className="text-[11px]">Preview unavailable</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md bg-gray-900/75 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {post.ref}
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium capitalize text-gray-800 backdrop-blur-sm">
          {post.format}
        </span>
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-50/95 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <Flame className="h-3 w-3" />
          {post.relative_score}× usual
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-gray-900">
            <PlatformIcon platform={post.platform} className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <span className="truncate">@{post.handle}</span>
          </span>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-gray-500">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatCount(post.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatCount(post.comments)}</span>
          {post.views !== null && <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatCount(post.views)}</span>}
          {post.engagement_rate !== null && <span>{post.engagement_rate}% eng.</span>}
        </div>
        {post.sound && (
          <p className="flex items-center gap-1 truncate text-xs text-gray-500">
            <Music2 className="h-3 w-3 flex-shrink-0" />
            {post.sound}
          </p>
        )}
        {analysis?.why_it_works ? (
          <p className="text-[13px] leading-5 text-gray-700">{analysis.why_it_works}</p>
        ) : (
          <p className="line-clamp-3 text-[13px] leading-5 text-gray-500">{post.caption || 'Caption not available'}</p>
        )}
        {(analysis?.visual_style || analysis?.hook) && (
          <dl className="mt-auto space-y-1 border-t border-gray-100 pt-2 text-xs leading-4">
            {analysis?.visual_style && (
              <div>
                <dt className="inline font-medium text-gray-700">Look: </dt>
                <dd className="inline text-gray-500">{analysis.visual_style}</dd>
              </div>
            )}
            {analysis?.hook && (
              <div>
                <dt className="inline font-medium text-gray-700">Hook: </dt>
                <dd className="inline text-gray-500">{analysis.hook}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </article>
  );
}

function InsightList({ items }: { items: Array<{ title: string; body: string; foot?: React.ReactNode }> }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(item => (
        <li key={item.title} className="py-2.5 first:pt-0 last:pb-0">
          <p className="text-[13px] font-semibold text-gray-900">{item.title}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-gray-600"><Refs text={item.body} /></p>
          {item.foot}
        </li>
      ))}
    </ul>
  );
}

// ── Report ───────────────────────────────────────────────────────────────────

export default function CompetitorResearchReport({
  clientId,
  reportId,
  report,
  warnings,
  meta,
  purged,
  retentionDays,
  toolbar,
}: {
  clientId: string;
  reportId: string;
  report: ResearchReport;
  warnings: string[];
  meta: { accounts: number; posts: number; createdAt: string };
  // Competitor captions and links were removed after the retention window
  purged: boolean;
  retentionDays: number;
  // Report picker etc., shown beside the tabs
  toolbar?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('ideas');
  const [highlight, setHighlight] = useState<string | null>(null);

  const analysisByRef = new Map(report.top_posts.map(t => [t.ref, t]));
  // Analysed posts first, in the order the model ranked them
  const posts = [...report.posts].sort((a, b) => {
    const ia = report.top_posts.findIndex(t => t.ref === a.ref);
    const ib = report.top_posts.findIndex(t => t.ref === b.ref);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Clicking "P3" anywhere jumps to that post
  const goToPost = (ref: string) => {
    setTab('posts');
    setHighlight(ref);
    requestAnimationFrame(() => document.getElementById(`post-${ref}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setTimeout(() => setHighlight(h => (h === ref ? null : h)), 2500);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Lightbulb; count?: number }> = [
    { id: 'ideas', label: 'Post ideas', icon: Lightbulb, count: report.post_ideas.length },
    { id: 'posts', label: 'Top posts', icon: TrendingUp, count: posts.length },
    { id: 'working', label: 'What’s working', icon: Sparkles },
    { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  ];

  return (
    <PostRefs.Provider value={new Set(report.posts.map(p => p.ref))}>
      <RefNav.Provider value={goToPost}>
        <div className="space-y-4">
          {/* Summary */}
          <section className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-blue-50/80 via-white to-white p-4 shadow-card">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-ai text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              Summary
              <span className="text-xs font-normal text-gray-500">
                {new Date(meta.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            </h3>
            <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-gray-800">
              <Refs text={report.summary} />
            </p>
            {purged && (
              <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-200/70">
                Competitors’ captions, images and post links are removed from reports after {retentionDays} days. The insights,
                post ideas and metrics are kept.
              </p>
            )}
            {warnings.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg bg-amber-50/80 px-3 py-2 ring-1 ring-amber-200/70">
                {warnings.map(w => (
                  <li key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="inline-flex max-w-full overflow-x-auto rounded-xl border border-gray-200/80 bg-white/70 p-1 shadow-xs backdrop-blur-sm"
              role="tablist"
            >
              {tabs.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.count ? <span className={cn('tabular-nums', tab === t.id ? 'text-blue-100' : 'text-gray-400')}>{t.count}</span> : null}
                </button>
              ))}
            </div>
            {toolbar}
          </div>

          {tab === 'ideas' && (
            <div className="space-y-4">
              {report.opportunities.length > 0 && (
                <SectionCard title="Where you can win" icon={Target} tone="bg-orange-50 text-orange-600 ring-orange-100">
                  <ul className="space-y-1.5">
                    {report.opportunities.map(o => (
                      <li key={o} className="flex gap-2 text-[13px] leading-5 text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" />
                        <span><Refs text={o} /></span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
              {report.post_ideas.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {report.post_ideas.map((idea, i) => (
                    <IdeaCard key={`${reportId}-${i}`} clientId={clientId} reportId={reportId} idea={idea} index={i} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-gray-200/80 bg-white/90 px-4 py-8 text-center text-[13px] text-gray-500 shadow-card">
                  No post ideas in this report.
                </p>
              )}
            </div>
          )}

          {tab === 'posts' &&
            (posts.length > 0 ? (
              <>
                <p className="text-xs text-gray-500">Ranked by how far each post beat its own account’s usual engagement.</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map(p => (
                    <PostCard key={`${p.platform}-${p.id}`} post={p} analysis={analysisByRef.get(p.ref)} highlighted={highlight === p.ref} />
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-gray-200/80 bg-white/90 px-4 py-8 text-center text-[13px] text-gray-500 shadow-card">
                This report was built from web trends only — track some accounts to see their top posts.
              </p>
            ))}

          {tab === 'working' && (
            <div className="grid items-start gap-3 md:grid-cols-2">
              {report.visual_trends.length > 0 && (
                <SectionCard title="Visual styles" icon={Palette} tone="bg-sky-50 text-sky-600 ring-sky-100">
                  <InsightList
                    items={report.visual_trends.map(t => ({
                      title: t.title,
                      body: t.description,
                      foot: t.examples.length > 0 && (
                        <p className="mt-1 text-[11px] text-gray-500">See <Refs text={t.examples.join(', ')} /></p>
                      ),
                    }))}
                  />
                </SectionCard>
              )}
              {report.caption_patterns.length > 0 && (
                <SectionCard title="Caption patterns" icon={Type}>
                  <InsightList
                    items={report.caption_patterns.map(c => ({
                      title: c.title,
                      body: c.description,
                      foot: c.example && (
                        <p className="mt-1.5 border-l-2 border-blue-200 pl-2 text-xs italic text-gray-500">{c.example}</p>
                      ),
                    }))}
                  />
                </SectionCard>
              )}
              {report.engagement_tactics.length > 0 && (
                <SectionCard title="Engagement tactics" icon={Heart} tone="bg-cyan-50 text-cyan-700 ring-cyan-100">
                  <InsightList
                    items={report.engagement_tactics.map(t => ({
                      title: t.title,
                      body: t.description,
                      foot: t.evidence && <p className="mt-1 text-[11px] text-gray-500"><Refs text={t.evidence} /></p>,
                    }))}
                  />
                </SectionCard>
              )}
              {report.trending_formats.length > 0 && (
                <SectionCard title="Trending right now" icon={Flame} tone="bg-orange-50 text-orange-600 ring-orange-100">
                  <InsightList
                    items={report.trending_formats.map(t => ({
                      title: t.title,
                      body: t.description,
                      foot: (
                        <>
                          {t.how_to_use && (
                            <p className="mt-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200/70">
                              <span className="font-medium">Try: </span>
                              {t.how_to_use}
                            </p>
                          )}
                          {t.sources.some(s => httpUrl(s)) && (
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                              {t.sources.filter(s => httpUrl(s)).map(s => (
                                <a
                                  key={s}
                                  href={s}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-[220px] items-center gap-1 truncate text-[11px] font-medium text-blue-700 hover:text-blue-800"
                                >
                                  {safeHost(s)} <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          )}
                        </>
                      ),
                    }))}
                  />
                </SectionCard>
              )}
            </div>
          )}

          {tab === 'benchmarks' && (
            <div className="space-y-3">
              {report.account_stats.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-gray-50/70">
                        <tr className="text-left text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">
                          <th className="px-4 py-2.5 font-medium">Account</th>
                          <th className="px-3 py-2.5 text-right font-medium">Followers</th>
                          <th className="px-3 py-2.5 text-right font-medium">Posts / wk</th>
                          <th className="px-3 py-2.5 text-right font-medium">Avg eng.</th>
                          <th className="px-3 py-2.5 font-medium">Formats</th>
                          <th className="px-3 py-2.5 text-right font-medium">Caption words</th>
                          <th className="px-3 py-2.5 text-right font-medium">Hashtags</th>
                          <th className="px-4 py-2.5 font-medium">Busiest days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 tabular-nums text-gray-700">
                        {report.account_stats.map(s => (
                          <tr key={`${s.platform}-${s.handle}`}>
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                              <span className="flex items-center gap-1.5">
                                <PlatformIcon platform={s.platform} className="h-3.5 w-3.5 text-gray-500" />@{s.handle}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">{formatCount(s.followers)}</td>
                            <td className="px-3 py-2.5 text-right">{s.posts_per_week ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right">{s.avg_engagement_rate !== null ? `${s.avg_engagement_rate}%` : '—'}</td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              {Object.entries(s.format_mix).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}
                            </td>
                            <td className="px-3 py-2.5 text-right">{s.avg_caption_words}</td>
                            <td className="px-3 py-2.5 text-right">{s.avg_hashtags}</td>
                            <td className="whitespace-nowrap px-4 py-2.5">{s.top_days.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-[11px] text-gray-500">
                    Instagram engagement = likes + comments ÷ followers. TikTok engagement = likes + comments + shares + saves ÷ views.
                    Based on {meta.posts} posts from the last 90 days.
                  </p>
                </section>
              ) : (
                <p className="rounded-2xl border border-gray-200/80 bg-white/90 px-4 py-8 text-center text-[13px] text-gray-500 shadow-card">
                  No account data in this report.
                </p>
              )}

              {report.trend_sources.some(s => httpUrl(s.url)) && (
                <SectionCard title="Web sources" icon={ExternalLink} tone="bg-gray-100 text-gray-600 ring-gray-200" meta={report.trend_sources.length}>
                  <ul className="space-y-1.5">
                    {report.trend_sources.filter(s => httpUrl(s.url)).map(s => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-blue-700 hover:text-blue-800 hover:underline">
                          {s.title || safeHost(s.url)}
                        </a>
                        <span className="ml-1.5 text-[11px] text-gray-400">{safeHost(s.url)}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
            </div>
          )}
        </div>
      </RefNav.Provider>
    </PostRefs.Provider>
  );
}
