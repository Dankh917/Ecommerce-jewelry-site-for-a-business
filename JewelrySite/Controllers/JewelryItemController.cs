using JewelrySite.BL;
using JewelrySite.DAL;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace JewelrySite.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	public class JewelryItemController : ControllerBase
	{

		private readonly JewelryItemService _service;

		public JewelryItemController(JewelryItemService service) { 
			_service = service;
		}

		[HttpGet]
		public async Task<ActionResult<List<JewelryItem>>> GetJewerlyItems()
		{
			List<JewelryItem> items = await _service.GetAllJewelry();
			return Ok(items);
		}

		[HttpGet("{id}")] 
		public async Task<ActionResult<JewelryItem>> GetJewerlyById(int id) 
		{
			JewelryItem j = await _service.GetJewelryById(id);
			if (j == null) {return NotFound();}
			return Ok(j);
		}

		[HttpPost]
		public async Task<ActionResult<JewelryItem>> AddJewerlyItem(JewelryItem j)
		{
			
			return await _service.AddJewelry(j) != null ? CreatedAtAction(nameof(AddJewerlyItem), j) : BadRequest();
		}

		//[HttpPut]
		//public ActionResult UpdateJewerlyItem(int id, JewelryItem updatedJewerly)
		//{
		//	if (JewelryItem.UpdateJewelryItem(id, updatedJewerly) != null) { return NoContent();}
		//	return BadRequest();
		//}

		//[HttpDelete]
		//public ActionResult DeleteJewerlyItem(int id)
		//{
		//	if (JewelryItem.DeleteJewelryItem(id)) {return NoContent();}
		//	return BadRequest();
		//}
	}
}
