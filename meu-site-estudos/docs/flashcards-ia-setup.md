# Setup do Flashcards + IA (GPT)

## 1) Variáveis `.env` do frontend

Crie/edite `meu-site-estudos/.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_SUPABASE_ANON_KEY
```

> Essas variáveis são usadas em `src/supabaseClient.js` para autenticação do app.

## 2) Secrets das Edge Functions (Supabase)

No terminal, dentro da pasta `meu-site-estudos`:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set OPENAI_API_KEY=sua_chave_openai
supabase secrets set SUPABASE_URL=https://SEU-PROJETO.supabase.co
supabase secrets set SUPABASE_ANON_KEY=SEU_SUPABASE_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
```

## 3) Aplicar banco de dados

```bash
supabase db push
```

Migração principal dessa entrega:
- `supabase/migrations/20260227120000_flashcards_topics_and_rls.sql`

## 4) Deploy das functions

```bash
supabase functions deploy flashcards-write
supabase functions deploy generate-flashcards
```

## 5) Como a conexão com GPT foi feita

1. A function `generate-flashcards` lê `OPENAI_API_KEY` dos secrets.
2. Ela chama a API OpenAI em `https://api.openai.com/v1/chat/completions`.
3. O retorno JSON é normalizado para **cards normais (pergunta/resposta)**, sem cloze.
4. O frontend chama essa function via `supabase.functions.invoke("generate-flashcards")`.

## 6) Fluxo do novo menu flashcards

1. Entrar em **Flashcards** no dashboard.
2. Selecionar em cascata: **Curso → Disciplina → Assunto → Tópico → Deck**.
3. Ativar **Modo edição** para criar itens da árvore.
4. Criar cards manuais (sem cloze) ou gerar por IA para o deck selecionado.

## 7) Dica para validar se sua chave já estava no projeto

Rode:

```bash
supabase secrets list
```

Se `OPENAI_API_KEY` aparecer, ela já estava registrada no projeto Supabase.
