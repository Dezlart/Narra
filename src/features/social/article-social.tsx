import { getArticleSocialState } from "./queries";
import { SocialButton } from "./social-button";
export async function ArticleSocial({ articleId, path }: { articleId: string; path: string }) {
  const state = await getArticleSocialState(articleId);
  return <div className="mt-7">
    <div className="flex flex-wrap items-center gap-3" aria-label="Реакции на статью">
      <SocialButton kind="like" target={articleId} active={state.liked} viewer={state.viewer} returnTo={path} count={state.likes} />
      <SocialButton kind="bookmark" target={articleId} active={state.saved} viewer={state.viewer} returnTo={path} />
      <a href="#comments" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Комментарии · {state.comments}</a>
    </div>
    {state.viewer === "banned" && <p className="mt-3 text-sm text-muted-foreground">Ваш аккаунт заблокирован. Социальные действия недоступны.</p>}
  </div>;
}
