from voyager import Voyager
from dotenv import load_dotenv
import os

load_dotenv()
# You can also use mc_port instead of azure_login, but azure_login is highly recommended
openai_api_key = os.getenv('openai_api_key')
voyager = Voyager(
    mc_port=54795,
    openai_api_key=openai_api_key,
    resume=False,
    log_to_file=True,
    curriculum_agent_mode="manual"
)

# start lifelong learning
voyager.learn()