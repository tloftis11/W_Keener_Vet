import ThreadView from "./ThreadView";

export default async function VetConversationPage(
  props: PageProps<"/vet/dashboard/[conversationId]">
) {
  const { conversationId } = await props.params;
  return <ThreadView conversationId={conversationId} />;
}
