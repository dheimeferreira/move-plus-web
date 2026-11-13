import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { SITE } from '../config/site';
import { ContactEmail } from '../components/ui/Brand';

const TOC = [
  ['controlador', '1. Quem somos'],
  ['dados', '2. Dados que coletamos'],
  ['finalidades', '3. Para que usamos'],
  ['bases', '4. Bases legais (LGPD)'],
  ['ia', '5. Processamento por inteligência artificial'],
  ['gps', '6. Localização e GPS de corrida'],
  ['compartilhamento', '7. Compartilhamento e operadores'],
  ['armazenamento', '8. Armazenamento e segurança'],
  ['retencao', '9. Retenção e exclusão'],
  ['direitos', '10. Seus direitos'],
  ['menores', '11. Crianças e adolescentes'],
  ['permissoes', '12. Permissões do aplicativo'],
  ['alteracoes', '13. Alterações e contato'],
];

export default function PrivacyPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">
          <ShieldCheck className="h-4 w-4" /> LGPD • Google Play
        </p>
        <h1 className="display mt-3 text-5xl font-extrabold leading-[0.95] sm:text-6xl">Política de Privacidade</h1>
        <p className="mt-4 text-muted">
          Aplicativo <strong className="text-fg">{SITE.appName}</strong> (pacote <code className="text-fg">{SITE.androidPackage}</code>) e site MOVE+.
          Última atualização: {SITE.policyUpdatedAt}.
        </p>

        <nav aria-label="Sumário" className="surface mt-8 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Sumário</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {TOC.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="text-muted hover:text-brand">{label}</a></li>
            ))}
          </ol>
        </nav>

        <article className="prose-legal mt-4">
          <p>
            Esta Política explica, de forma clara, quais dados pessoais o MOVE+ trata, por que, com quem compartilha,
            por quanto tempo guarda e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD) e a Política de Dados do Usuário do Google Play.
          </p>

          <h2 id="controlador">1. Quem somos</h2>
          <p>
            O MOVE+ é uma plataforma digital de treino, corrida e nutrição. Para fins da LGPD, o MOVE+ é o
            <strong> controlador</strong> dos dados pessoais tratados no aplicativo e neste site. Contato do encarregado
            de proteção de dados (DPO): <ContactEmail />.
          </p>

          <h2 id="dados">2. Dados que coletamos</h2>
          <h3>2.1 Dados cadastrais e de conta</h3>
          <ul>
            <li>Nome, e-mail e senha (a senha é armazenada apenas de forma criptografada pelo serviço de autenticação, nunca em texto puro).</li>
            <li>Foto de perfil, quando você escolhe enviar uma.</li>
            <li>Plano contratado (Gratuito ou VIP) e cargo na plataforma.</li>
          </ul>
          <h3>2.2 Dados biométricos, corporais e de saúde (dados sensíveis)</h3>
          <ul>
            <li>Idade, sexo biológico, altura, peso atual, peso inicial e peso-alvo.</li>
            <li>Pesagens, percentual de gordura e medidas corporais (cintura, quadril, peitoral, braços, coxas e panturrilha).</li>
            <li>Patologias, lesões, restrições articulares ou clínicas que você declarar na anamnese.</li>
            <li>Objetivo (emagrecimento, hipertrofia, definição ou condicionamento), frequência semanal e local de treino.</li>
          </ul>
          <h3>2.3 Dados de atividade física</h3>
          <ul>
            <li>Séries de treino registradas: exercício, carga, repetições, data e sessão.</li>
            <li>Protocolos de treino gerados para você e seu progresso no mesociclo.</li>
            <li>Corridas: distância, duração, ritmo (pace), calorias estimadas e o trajeto percorrido (ver seção 6).</li>
          </ul>
          <h3>2.4 Dados de nutrição</h3>
          <ul>
            <li>Refeições, alimentos, suplementos e consumo diário registrados.</li>
            <li>Fotos de pratos enviadas para análise e códigos de barras de produtos escaneados.</li>
          </ul>
          <h3>2.5 Conversas com a ZORYX AI</h3>
          <ul>
            <li>Mensagens de texto enviadas à treinadora virtual e áudios gravados por você para transcrição.</li>
          </ul>
          <h3>2.6 Dados técnicos</h3>
          <ul>
            <li>Token de notificações push, versão do aplicativo, plataforma e informações de sincronização offline (quantidade de registros pendentes e erros técnicos), usados para garantir que nenhum treino ou corrida se perca.</li>
            <li>No formulário público de exclusão de conta: um identificador irreversível (hash com chave secreta) do endereço IP, usado exclusivamente para prevenir abuso, e o tipo de navegador.</li>
          </ul>
          <p>
            <strong>Não</strong> coletamos dados de contatos, SMS, histórico de chamadas, arquivos pessoais fora dos que você
            escolhe enviar, nem identificadores de publicidade para rastreamento entre apps. <strong>Não vendemos dados pessoais.</strong>
          </p>

          <h2 id="finalidades">3. Para que usamos seus dados</h2>
          <ul>
            <li>Criar e manter sua conta e autenticar seu acesso no app e no site.</li>
            <li>Gerar, acompanhar e evoluir protocolos de treino personalizados, respeitando suas restrições de saúde.</li>
            <li>Registrar e exibir corridas, rotas, métricas de desempenho e histórico de evolução.</li>
            <li>Calcular metas nutricionais e analisar refeições.</li>
            <li>Gerenciar a assinatura VIP e o acesso aos recursos do plano.</li>
            <li>Enviar notificações que você autorizou (lembretes de treino, por exemplo).</li>
            <li>Garantir segurança, prevenir fraudes e abusos e cumprir obrigações legais.</li>
          </ul>

          <h2 id="bases">4. Bases legais (LGPD)</h2>
          <table>
            <thead>
              <tr><th>Tratamento</th><th>Base legal</th></tr>
            </thead>
            <tbody>
              <tr><td>Conta, treinos, corridas e nutrição</td><td>Execução de contrato (art. 7º, V)</td></tr>
              <tr><td>Dados de saúde, biometria e restrições clínicas</td><td>Consentimento específico e destacado do titular (art. 11, I), coletado na anamnese</td></tr>
              <tr><td>Localização GPS durante a corrida</td><td>Consentimento (permissão do sistema operacional), revogável a qualquer momento</td></tr>
              <tr><td>Segurança, prevenção a fraudes e rate limit</td><td>Legítimo interesse (art. 7º, IX)</td></tr>
              <tr><td>Registros de pagamento e solicitações de exclusão</td><td>Cumprimento de obrigação legal ou regulatória (art. 7º, II) e exercício regular de direitos</td></tr>
            </tbody>
          </table>

          <h2 id="ia">5. Processamento por inteligência artificial</h2>
          <p>
            A ZORYX AI usa modelos de linguagem fornecidos pela <strong>OpenAI</strong> para gerar protocolos de treino,
            responder ao chat, transcrever áudios e analisar fotos de refeições. Para isso:
          </p>
          <ul>
            <li>As requisições passam primeiro pelos nossos servidores (funções de backend), que enviam ao provedor <strong>apenas o mínimo necessário</strong> para a tarefa (por exemplo: objetivo, frequência, restrições e histórico de cargas para montar um treino). Seu e-mail e senha nunca são enviados.</li>
            <li>A decisão sobre a evolução do seu treino é tomada no servidor, a partir dos seus registros reais — o aplicativo não envia números que decidam o plano.</li>
            <li>O provedor atua como operador, sob contrato, e não usa os dados enviados por API para treinar seus modelos, conforme os termos comerciais dele.</li>
            <li>Há limite de uso para evitar abuso, e as respostas da IA têm caráter <strong>esportivo e consultivo</strong>: não substituem avaliação médica, nutricional ou de educação física presencial.</li>
          </ul>

          <h2 id="gps">6. Localização e GPS de corrida</h2>
          <ul>
            <li>A localização precisa é coletada <strong>somente enquanto uma corrida está em andamento</strong>, iniciada por você.</li>
            <li>Para que a medição não pare com a tela bloqueada, o app usa localização em segundo plano com uma notificação permanente visível durante toda a corrida. Ao encerrar a corrida, a coleta para.</li>
            <li>O trajeto, a distância e o ritmo ficam vinculados à sua conta para compor seu histórico. Não usamos sua localização para publicidade.</li>
            <li>Você pode negar ou revogar a permissão a qualquer momento nas configurações do Android; os demais recursos continuam funcionando.</li>
          </ul>

          <h2 id="compartilhamento">7. Compartilhamento e operadores</h2>
          <p>Compartilhamos dados apenas com operadores necessários para o funcionamento do serviço:</p>
          <ul>
            <li><strong>Supabase</strong> — banco de dados, autenticação, armazenamento de arquivos e funções de backend.</li>
            <li><strong>OpenAI</strong> — processamento de IA descrito na seção 5.</li>
            <li><strong>Expo Push e Google Firebase Cloud Messaging</strong> — entrega de notificações push (recebem apenas o token do aparelho e o texto da notificação).</li>
            <li><strong>Open Food Facts</strong> — consulta de produtos por código de barras (é enviado apenas o código escaneado).</li>
            <li><strong>Vercel</strong> — hospedagem deste site.</li>
            <li>Autoridades públicas, somente quando houver obrigação legal ou ordem judicial.</li>
          </ul>
          <p>
            Alguns desses fornecedores podem processar dados fora do Brasil. Nesses casos, a transferência internacional
            ocorre com base em cláusulas contratuais e garantias de proteção compatíveis com a LGPD (art. 33).
          </p>

          <h2 id="armazenamento">8. Armazenamento e segurança</h2>
          <ul>
            <li>Os dados ficam armazenados na infraestrutura do Supabase, com criptografia em trânsito (HTTPS/TLS) e em repouso.</li>
            <li>Regras de segurança em nível de linha (Row Level Security) garantem que cada usuário acesse apenas os próprios dados. Dados sensíveis de um atleta não são visíveis para outros usuários.</li>
            <li>O acesso administrativo é restrito a uma única conta, verificada no próprio banco de dados, e toda ação administrativa é registrada em log de auditoria.</li>
            <li>Arquivos públicos (vídeos de exercícios e imagens da loja) não contêm dados pessoais.</li>
          </ul>

          <h2 id="retencao">9. Retenção e exclusão</h2>
          <ul>
            <li>Mantemos seus dados enquanto sua conta estiver ativa.</li>
            <li>Ao excluir a conta, apagamos definitivamente perfil, dados de saúde, treinos, corridas, nutrição, conversas com a IA e arquivos enviados (fotos), em até <strong>{SITE.deletionDeadlineDays} dias</strong>. A exclusão feita pelo próprio aplicativo é imediata.</li>
            <li>Podem ser mantidos, pelo prazo legal, apenas registros que a lei obriga a guardar (por exemplo, registros de transações financeiras e o próprio pedido de exclusão, como comprovação do atendimento).</li>
            <li>Saiba como excluir sua conta em <Link to="/excluir-conta">Excluir conta e dados</Link>.</li>
          </ul>

          <h2 id="direitos">10. Seus direitos como titular</h2>
          <p>Nos termos do art. 18 da LGPD, você pode, a qualquer momento:</p>
          <ul>
            <li>Confirmar a existência de tratamento e acessar seus dados;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados (diretamente no perfil do app);</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Solicitar a portabilidade dos dados;</li>
            <li>Revogar o consentimento e solicitar a eliminação dos dados tratados com base nele;</li>
            <li>Obter informação sobre com quem compartilhamos seus dados;</li>
            <li>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
          </ul>
          <p>Para exercer seus direitos, escreva para <ContactEmail />. Responderemos em até 15 dias.</p>

          <h2 id="menores">11. Crianças e adolescentes</h2>
          <p>
            O MOVE+ é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos
            uma conta de menor sem o consentimento de um responsável legal, ela será excluída.
          </p>

          <h2 id="permissoes">12. Permissões do aplicativo</h2>
          <ul>
            <li><strong>Localização (precisa e em segundo plano):</strong> medir corridas com GPS (seção 6).</li>
            <li><strong>Câmera:</strong> foto de perfil, fotos de refeições e leitura de código de barras.</li>
            <li><strong>Microfone:</strong> enviar mensagens de voz para a ZORYX AI.</li>
            <li><strong>Notificações:</strong> lembretes e acompanhamento da corrida em andamento.</li>
          </ul>
          <p>Todas são solicitadas apenas quando o recurso é usado e podem ser revogadas nas configurações do Android.</p>

          <h2 id="alteracoes">13. Alterações e contato</h2>
          <p>
            Podemos atualizar esta Política para refletir melhorias no serviço ou mudanças legais. Alterações relevantes
            serão comunicadas no aplicativo. Dúvidas: <ContactEmail />.
          </p>
        </article>
      </div>
    </div>
  );
}
