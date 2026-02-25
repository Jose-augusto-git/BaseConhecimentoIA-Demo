from ai_engine.orchestrator import AIService

# Instância global (será inicializada sob demanda)
_ai_service_instance = None

def get_ai_service() -> AIService:
    global _ai_service_instance
    if _ai_service_instance is None:
        _ai_service_instance = AIService()
    return _ai_service_instance

# Expose AIService class if needed for type hinting elsewhere, 
# though usually get_ai_service() is enough
__all__ = ['get_ai_service', 'AIService', 'ai_service']

# Helper para compatibilidade legada (testes antigos importam ai_service)
class AIServiceProxy:
    def __getattr__(self, name):
        return getattr(get_ai_service(), name)
    def __repr__(self):
        return repr(get_ai_service())

ai_service = AIServiceProxy()

