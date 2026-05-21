import asyncio
from agent import UdhaAiAgent
from google.genai import types

async def main():
    agent = UdhaAiAgent()
    content = types.Content(role='user', parts=[types.Part(text='Si të shkoj nga stacioni qendror në Aeroportin e Prishtinës?')])
    i = 0
    async for event in agent.runner.run_async(user_id='user_1', session_id='user_session_1', new_message=content):
        i += 1
        print('EVENT', i, type(event))
        print('TEXT:', getattr(event, 'text', None))
        cont = getattr(event, 'content', None)
        print('CONTENT:', cont)
        if cont is not None:
            parts = getattr(cont, 'parts', []) or []
            print('content parts len:', len(parts))
            for p in parts:
                print(' part type=', type(p), 'text=', getattr(p, 'text', None), 'func_resp=', getattr(p, 'function_response', None), 'func_call=', getattr(p, 'function_call', None))
        cand = getattr(event, 'candidates', None)
        print('CANDIDATES:', 'yes' if cand else 'no')
        if cand:
            print('  num candidates', len(cand))
            print('  first content', getattr(cand[0], 'content', None))
        if i >= 5:
            break

asyncio.run(main())
