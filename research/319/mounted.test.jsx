import { Thread } from '@chat-js/thread';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, createElement, useContext } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { ConversationView, useConversationView } from '../../apps/chat/components/chat/conversation-view';
import { useViewMessages } from '../../apps/chat/lib/chat/view-hooks';
import { createArtifactOrigin } from '../../apps/chat/lib/chat/artifact-origin';

// Only the application/runtime binding is substituted. Production view/provider,
// hooks, Thread execution, query client and React subscriptions run unchanged.
const binding = vi.hoisted(() => ({ useThread: undefined }));
vi.mock('../../apps/chat/lib/stores/custom-store-provider', () => ({
 useApplicationThread: () => binding.useThread(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const Runtime = createContext(null);
binding.useThread = () => useContext(Runtime);
const user = id => ({ id, role: 'user', parts: [{type: 'text', text: id}], metadata: { parentMessageId: null } });

it('mounted views preserve independent cursors, shared query lifetime, stop targets and detached artifact origin', async () => {
 const requests = [];
 const transport = {
  sendMessages: options => Promise.resolve(new ReadableStream({ start(controller) {
   requests.push({options, controller});
   options.abortSignal.addEventListener('abort', () => { controller.enqueue({type:'abort'}); controller.close(); }, {once:true});
  }})),
  reconnectToStream: () => Promise.resolve(null),
 };
 const thread = new Thread({id:'mounted', messages:[user('root')], transport});
 const client = new QueryClient({defaultOptions:{queries:{retry:false, staleTime:Infinity, gcTime:Infinity}}});
 const fetch = vi.fn(async () => 'shared query');
 const views = {};
 function Probe({name}) {
  views[name] = useConversationView();
  const path = useViewMessages(messages => messages.map(m => m.id).join(','));
  const query = useQuery({queryKey:['conversation',thread.id], queryFn:fetch});
  return createElement('output', {name}, `${path}|${query.data ?? 'loading'}`);
 }
 function Tree({showA = true}) {
  return createElement(QueryClientProvider,{client},createElement(Runtime.Provider,{value:thread},
   showA && createElement(ConversationView,{id:'a'},createElement(Probe,{name:'a'})),
   createElement(ConversationView,{id:'b'},createElement(Probe,{name:'b'}))));
 }
 let root;
 await act(async () => {root = create(createElement(Tree));});
 await act(async () => {await new Promise(resolve => setTimeout(resolve,10));});
 expect(fetch).toHaveBeenCalledTimes(1);
 const retained = views.a;
 let a, b;
 await act(async () => {a = await views.a.startRun({message:user('a')}); b = await views.b.startRun({message:user('b')});});
 const output = name => root.root.findAllByType('output').find(node => node.props.name === name).children.join('');
 expect(output('a')).toBe('root,a|shared query');
 expect(output('b')).toBe('root,b|shared query');
 const origin = createArtifactOrigin(views.a,'a',undefined);
 await act(async () => { views.a.select('root'); root.update(createElement(Tree,{showA:false})); });
 expect(requests[0].options.abortSignal.aborted).toBe(false);
 await act(async () => {await views.b.stop(); await b.finished;});
 expect(requests[1].options.abortSignal.aborted).toBe(true);
 expect(requests[0].options.abortSignal.aborted).toBe(false);
 let panel;
 await act(async () => {panel = origin.sendMessage(user('edit')); await Promise.resolve();});
 expect(thread.getParent('edit').id).toBe('a');
 expect(views.b.store.getState().cursorId).toBe('b');
 await act(async () => { await origin.stop(); await panel; requests[0].controller.close(); await a.finished; });
 await act(async () => {root.update(createElement(Tree));});
 expect(views.a).toBe(retained);
 expect(output('a')).toBe('root|shared query');
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async () => root.unmount());
 expect(client.getQueryData(['conversation',thread.id])).toBe('shared query');
 client.clear();
});
